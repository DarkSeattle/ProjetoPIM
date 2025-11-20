import sql from 'mssql';
import 'dotenv/config';

const config = {
    server: process.env.SQL_SERVER,
    port: parseInt(process.env.SQL_PORT, 10),
    user: process.env.SQL_USER,
    password: process.env.SQL_PASSWORD,
    database: process.env.SQL_DATABASE,
    options: {
        encrypt: false,
        trustServerCertificate: true
    },
    pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000
    }
};

// Cria pool único global
let poolPromise = null;

export async function connectDB() {
    if (!poolPromise) {
        poolPromise = sql.connect(config)
            .then(pool => {
                console.log('✅ Conectado ao SQL Server com sucesso!');
                return pool;
            })
            .catch(err => {
                poolPromise = null; // reset se falhar
                console.error('❌ Erro na conexão:', err);
                throw err;
            });
    }
    return poolPromise;
}

export { sql };
