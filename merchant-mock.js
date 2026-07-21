const http = require("http");
const port = 8085;

let sequence = 1000;

function pad(n) {
    return String(n).padStart(2, "0");
}

function getFormattedDateTime() {
    const now = new Date();
    return {
        fecha: `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}`,
        hora: `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
    };
}

function renderCheckoutHtml(amount, cedula) {
    return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>VPOS Mock</title>
<style>
    body { font-family: sans-serif; margin: 0; padding: 16px; background: #f1f5f9; }
    form { display: flex; flex-direction: column; gap: 12px; max-width: 320px; margin: 0 auto; }
    .monto { font-size: 1.4rem; font-weight: bold; text-align: center; }
    label { font-size: 0.9rem; }
    select, input, button { padding: 8px; font-size: 1rem; }
    button { cursor: pointer; }
</style>
</head>
<body>
<form id="form">
    <div class="monto">Monto: Bs ${Number(amount).toFixed(2)}</div>

    <label for="tipoTarjeta">Tipo de tarjeta</label>
    <select id="tipoTarjeta" name="tipoTarjeta">
        <option value="D">Débito</option>
        <option value="C">Crédito</option>
    </select>

    <label for="clave">Clave</label>
    <input id="clave" name="clave" type="password" inputmode="numeric" maxlength="6" required>

    <button type="submit">Aceptar</button>
</form>

<script>
    var amount = ${JSON.stringify(String(amount))};
    var cedula = ${JSON.stringify(String(cedula))};

    document.getElementById('form').addEventListener('submit', function (e) {
        e.preventDefault();

        var tipoTarjeta = document.getElementById('tipoTarjeta').value;
        var clave = document.getElementById('clave').value;

        fetch('/vpos/metodo', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                accion: 'tarjeta',
                cedula: cedula,
                montoTransaccion: amount,
                tipoTarjeta: tipoTarjeta,
                clave: clave
            })
        })
            .then(function (r) { return r.json(); })
            .then(function (data) {
                window.parent.postMessage(JSON.stringify(data), '*');
            });
    });
</script>
</body>
</html>`;
}

const server = http.createServer((req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");

    if (req.method === "OPTIONS") {
        res.writeHead(204);
        res.end();
        return;
    }

    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);

    if (req.method === "GET" && req.url === "/vpos/ping") {
        res.writeHead(200, { "Content-Type": "text/plain" });
        res.end("OK");
        return;
    }

    if (req.method === "GET" && req.url.startsWith("/vpos/checkout")) {
        const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
        const amount = parsedUrl.searchParams.get("amount") || "0.00";
        const cedula = parsedUrl.searchParams.get("cedula") || "";

        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(renderCheckoutHtml(amount, cedula));
        return;
    }

    if (req.method === "POST" && (req.url === "/vpos/metodo" || req.url === "/vpos/metodo_cashea")) {
        let body = "";
        req.on("data", chunk => {
            body += chunk.toString();
        });

        req.on("end", () => {
            let payload = {};
            try {
                if (body) {
                    payload = JSON.parse(body);
                }
            } catch (err) {
                console.error("Error parseando JSON body:", err.message);
            }

            sequence++;
            const { fecha, hora } = getFormattedDateTime();
            let response = {};

            if (req.url === "/vpos/metodo") {
                console.log("-> Payload VPos metodo:", JSON.stringify(payload, null, 2));
                response = {
                    codRespuesta: "00",
                    mensajeRespuesta: "APROBADO",
                    numSeq: sequence,
                    nombreVoucher: `VOUCHER_${sequence}.TXT`,
                    numeroTarjeta: "555544******1111",
                    cedula: payload.cedula || "V12345678",
                    montoTransaccion: payload.montoTransaccion || "100",
                    montoCriptomoneda: "",
                    descrCriptomoneda: "",
                    tipoCuenta: "AHORROS",
                    tipoTarjeta: payload.tipoTarjeta || "D",
                    fechaExpiracion: "1229",
                    fechaTransaccion: fecha,
                    horaTransaccion: hora,
                    tipoTransaccion: "01",
                    numSeqOrden: sequence,
                    tipoCriptomoneda: "",
                    tid: "12345678",
                    numeroReferencia: String(Math.floor(Math.random() * 9000000000) + 1000000000),
                    nombreAutorizador: "MERCANTIL",
                    codigoAdquiriente: "123456",
                    tipoMoneda: "VES",
                    tipoProducto: "debito",
                    montoDivisa: "0",
                    descrMoneda: "Bolivares",
                    medioPago: 1
                };

                if (payload.accion === "precierre" || payload.accion === "cierre") {
                    response.codRespuesta = "00";
                    response.mensajeRespuesta = "CIERRE EXITOSO";
                }
            } else if (req.url === "/vpos/metodo_cashea") {
                console.log("-> Payload VPos metodo_cashea:", JSON.stringify(payload, null, 2));
                response = {
                    codRespuesta: "00",
                    mensajeRespuesta: "APROBADO",
                    numSeq: sequence,
                    nombreVoucher: `VOUCHER_CASHEA_${sequence}.TXT`,
                    numeroTarjeta: "",
                    cedula: payload.cedula || "V12345678",
                    montoTransaccion: payload.montoTransaccion || "100",
                    montoCriptomoneda: "",
                    descrCriptomoneda: "",
                    tipoCuenta: "",
                    tipoTarjeta: "",
                    fechaExpiracion: "",
                    fechaTransaccion: fecha,
                    horaTransaccion: hora,
                    tipoTransaccion: "01",
                    numSeqOrden: sequence,
                    tipoCriptomoneda: "",
                    tid: "CASHEA01",
                    numeroReferencia: String(Math.floor(Math.random() * 9000000000) + 1000000000),
                    nombreAutorizador: "CASHEA",
                    codigoAdquiriente: "654321",
                    tipoMoneda: "USD",
                    tipoProducto: "cashea",
                    montoDivisa: payload.montoTransaccion || "100",
                    descrMoneda: "Dolares",
                    medioPago: 8,
                    montoTransaccionDolares: payload.montoTransaccion || "100",
                    montoFinanciado: "7000",
                    montoFinanciadoDolares: "7000",
                    idOrden: payload.idOrden || `CASH-${sequence}`
                };
            }

            setTimeout(() => {
                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(JSON.stringify(response));
            }, 1000);
        });
        return;
    }

    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not Found");
});

server.listen(port, () => {
    console.log(`\n💳 MERCHANT MOCK SERVER STARTED ON PORT ${port} (HTTP nativo)`);
    console.log(`- GET  http://localhost:${port}/vpos/ping`);
    console.log(`- POST http://localhost:${port}/vpos/metodo`);
    console.log(`- POST http://localhost:${port}/vpos/metodo_cashea\n`);
});
