import { Sequelize } from "sequelize";

export default new Sequelize(
    'bot',
    'bot',
    'bot',
    {
        host: 'localhost',
        port: '5432',
        dialect: 'postgres'
    }
)
