/* eslint-disable no-unused-vars */
const log = require('./log');
const dbClient = require('../ClusterOperator/DBClient');

class ConnectionPool {
  static #connections = [];

  static #freeConnections = [];

  static #dbName = '';

  static #maxConnections;

  /**
  * [init]
  */
  static async init(params = { numberOfConnections: 10, maxConnections: 100, db: '' }) {
    this.#dbName = params.db;
    this.#maxConnections = params.maxConnections;
    for (let id = 0; id < params.numberOfConnections; id += 1) {
      // eslint-disable-next-line no-await-in-loop
      await this.#getNewConnection();
    }
  }

  /**
  * [getNewConnection]
  * @return {connection} [description]
  */
  static async #getNewConnection() {
    if (this.#connections.length > this.#maxConnections) {
      throw new Error('max connection limit reached.');
    }
    const dbConn = await dbClient.createClient();
    await dbConn.setDB(this.#dbName);
    const connId = this.#connections.length;
    const connObj = { id: connId, conn: dbConn, socket: null };
    this.#connections.push(connObj);
    this.#freeConnections.push(connId);
    return connObj;
  }

  /**
  * [keepFreeConnections]
  */
  static async keepFreeConnections() {
    for (let id = 0; id < this.#freeConnections.length; id += 1) {
      // eslint-disable-next-line no-await-in-loop
      await this.#connections[this.#freeConnections[id]].conn.setDB(this.#dbName);
    }
  }

  /**
  * [getFreeConnection]
  * @param {socket} socket [description]
  * @return {int} [description]
  */
  static async getFreeConnection(socket) {
    if (this.#freeConnections.length) {
      const connId = this.#freeConnections.shift();
      this.#connections[connId].socket = socket;
      this.#connections[connId].conn.setSocket(socket, connId);
      console.log(`retuning ID: ${connId}`);
      // socket.once('close', this.releaseConnection(connId));
      return connId;
    }
    const connObj = await this.#getNewConnection();
    connObj.socket = socket;
    connObj.conn.setSocket(socket, connObj.id);
    console.log(`retuning ID: ${connObj.id}`);
    // socket.once('close', this.releaseConnection(connObj.id));
    return connObj.id;
  }

  /**
  * [getSocketById]
  * @param {int} connId [description]
  * @return {socket} [description]
  */
  static getSocketById(connId) {
    return this.#connections[connId].socket;
  }

  /**
  * [getConnectionById]
  * @param {int} connId [description]
  * @return {connection} [description]
  */
  static getConnectionById(connId) {
    return this.#connections[connId].conn;
  }

  /**
  * [releaseConnection]
  * @param {int} connId [description]
  */
  static releaseConnection(connId) {
    if (connId !== null) {
      log.info(`releasing ${connId}`);
      if (this.#connections[connId].socket) {
        this.#connections[connId].socket = null;
        this.#connections[connId].conn.disableSocketWrite();
        this.#freeConnections.push(connId);
      }
    }
  }
}
module.exports = ConnectionPool;
