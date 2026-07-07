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
                    tipoTarjeta: "D",
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
