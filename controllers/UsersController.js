import dbClient from '../utils/db';
import redisClient from '../utils/redis';

const { ObjectID } = require('mongodb');
const sha1 = require('sha1');

class UsersController {
  static async postNew(req, res) {
    const { email, password } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Missing email' });
    }
    if (!password) {
      return res.status(400).json({ error: 'Missing password' });
    }
    const collection = dbClient.client
      .db(dbClient.database)
      .collection('users');
    const user = await collection.find({ email }).toArray();
    if (user.length > 0) {
      return res.status(400).json({ error: 'Already exist' });
    }
    const hashPwd = sha1(password);
    const insertUser = await collection.insertOne({ email, password: hashPwd });
    const userID = insertUser.insertedId;
    return res.status(201).json({ id: userID, email });
  }

  static async getMe(req, res) {
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
    return res.status(200).json({ id: userId, email: user.email });
  }
}

module.exports = UsersController;
