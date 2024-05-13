import dbClient from '../utils/db';
import redisClient from '../utils/redis';

const sha1 = require('sha1');
const uuidv4 = require('uuid').v4;
const { ObjectID } = require('mongodb');

class AuthController {
  static async getConnect(req, res) {
    const { authorization } = req.headers;
    if (!authorization) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const authCode = authorization.split(' ')[1];
    const authCodeDecode = Buffer.from(authCode, 'base64').toString().split(':');
    if (authCodeDecode.length !== 2) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const email = authCodeDecode[0];
    const password = authCodeDecode[1];
    const hashPwd = sha1(password);
    const dbCollection = dbClient.client
      .db(dbClient.database)
      .collection('users');
    const user = await dbCollection.findOne({ email, password: hashPwd });
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const token = uuidv4();
    try {
      await redisClient.set(`auth_${token}`, user._id.toString(), 86400);
    } catch (err) {
      console.error(err);
    }
    return res.status(200).json({ token });
  }

  static async getDisconnect(req, res) {
    const token = req.headers['x-token'];
    const userId = await redisClient.get(`auth_${token}`);
    if (userId == null) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const collection = dbClient.client
      .db(dbClient.database)
      .collection('users');
    const user = await collection.findOne({ _id: new ObjectID(userId) });
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    await redisClient.del(`auth_${token}`);
    return res.status(204).send('');
  }
}

module.exports = AuthController;
