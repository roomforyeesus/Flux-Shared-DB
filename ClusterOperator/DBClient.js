/* eslint-disable no-unused-vars */
const mySql = require('mysql2/promise');
const net = require('net');
const config = require('./config');
const log = require('../lib/log');

class DBClient {
  constructor() {
    this.connection = {};
    this.connected = false;
    this.InitDB = '';
    this.stream = null;
    this.socketCallBack = null;
    this.socketId = null;
    this.enableSocketWrite = false;
  }

  /**
  * [init]
  */
  async createSrtream() {
    this.stream = net.connect({
      host: config.dbHost,
      port: config.dbPort,
    });
    const { stream } = this;
    return new Promise((resolve, reject) => {
      stream.once('connect', () => {
        stream.removeListener('error', reject);
        resolve(stream);
      });
      stream.once('error', (err) => {
        stream.removeListener('connection', resolve);
        stream.removeListener('data', resolve);
        reject(err);
      });
    });
  }

  /**
  * [rawCallback]
  */
  rawCallback(data) {
    if (this.socketCallBack && this.enableSocketWrite) {
      this.socketCallBack.write(data);
      log.info(`writing to ${this.socketId}: ${data.length} bytes`);
    }
  }

  /**
  * [setSocket]
  */
  setSocket(func, id = null) {
    if (func === null) log.info('socket set to null');
    this.socketCallBack = func;
    this.socketId = id;
    this.enableSocketWrite = true;
  }

  /**
  * [disableSocketWrite]
  */
  disableSocketWrite() {
    log.info(`socket write disabled for ${this.socketId}`);
    this.enableSocketWrite = false;
    this.socketId = null;
  }

  /**
  * [init]
  */
  async init() {
    if (config.dbType === 'mysql') {
      await this.createSrtream();
      this.stream.on('data', (data) => {
        this.rawCallback(data);
      });
      this.connection = await mySql.createConnection({
        password: config.dbPass,
        user: config.dbUser,
        stream: this.stream,
      });
      this.connection.once('error', () => {
        this.connected = false;
        console.log(`mysql connected: ${this.connected}`);
      });
      this.connected = true;
    }
  }

  /**
  * [query]
  * @param {string} query [description]
  */
  async query(query, rawResult = false) {
    if (config.dbType === 'mysql') {
      // log.info(`running Query: ${query}`);
      try {
        if (!this.connected) {
          log.info(`Connecten to ${this.InitDB} DB was lost, reconnecting...`);
          await this.init();
          this.setDB(this.InitDB);
        }
        if (rawResult) {
          const [rows, fields, err] = await this.connection.query(query);
          if (err) console.log(`Error running query: ${JSON.stringify(err)}`);
          return [rows, fields, err];
        // eslint-disable-next-line no-else-return
        } else {
          const [rows, err] = await this.connection.query(query);
          if (err) console.log(`Error running query: ${JSON.stringify(err)}`);
          return rows;
        }
      } catch (err) {
        log.info(err);
        return [null, null, err];
      }
    }
    return null;
  }

  /**
  * [execute]
  * @param {string} query [description]
  * @param {array} params [description]
  */
  async execute(query, params, rawResult = false) {
    if (config.dbType === 'mysql') {
      try {
        if (!this.connected) {
          await this.init();
        }
        const [rows, fields, err] = await this.connection.execute(query, params);
        if (err) log.info(`Error executing query: ${JSON.stringify(err)}`);
        if (rawResult) return [rows, fields, err];
        return rows;
      } catch (err) {
        return [null, null, err];
      }
    }
    return null;
  }

  /**
  * [createDB]
  * @param {string} dbName [description]
  */
  async createDB(dbName) {
    if (config.dbType === 'mysql') {
      try {
        await this.query(`CREATE DATABASE IF NOT EXISTS ${dbName}`);
      } catch (err) {
        log.info(`DB ${dbName} exists`);
      }
    }
    return null;
  }

  /**
  * [setDB]
  * @param {string} dbName [description]
  */
  async setDB(dbName) {
    if (config.dbType === 'mysql') {
      this.InitDB = dbName;
      // log.info(`seting db to ${dbName}`);
      this.connection.changeUser({
        database: dbName,
      }, (err) => {
        if (err) {
          console.log('Error changing database', err);
        }
      });
    }
  }
}

// eslint-disable-next-line func-names
exports.createClient = async function () {
  try {
    const cl = new DBClient();
    await cl.init();
    return cl;
  } catch (err) {
    log.info(err);
    return null;
  }
};
