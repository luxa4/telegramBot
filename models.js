import sequelize from './db.js'
import { DataTypes } from "sequelize";

export const User = sequelize.define('user', {
    id: { type: DataTypes.INTEGER, primaryKey: true, unique: true, autoIncrement: true},
    chatId: { type: DataTypes.STRING, unique: true},
    name: {type: DataTypes.STRING },
    phone: {type: DataTypes.STRING },
    field: {type: DataTypes.STRING },
    right: { type: DataTypes.INTEGER, default: 0},
    wrong: { type: DataTypes.INTEGER, default: 0},
    team: { type: DataTypes.INTEGER},
    quest: { type: DataTypes.ARRAY(DataTypes.INTEGER)},
    count: { type: DataTypes.INTEGER, default: 0},
    skip: { type: DataTypes.INTEGER, default: 0},
    time: { type: DataTypes.DATE },
    isStart: { type: DataTypes.BOOLEAN },
    isFinish: { type: DataTypes.BOOLEAN }
})
