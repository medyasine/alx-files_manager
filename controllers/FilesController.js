import { env } from 'process';
import { promisify } from 'util';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

const uuidv4 = require('uuid').v4;
const mime = require('mime-types');
const fs = require('fs');
const { ObjectID } = require('mongodb');

class FilesController {
  static async postUpload(req, res) {
    // Defining our DB collections
    const users = dbClient.client.db(dbClient.database).collection('users');
    const files = dbClient.client.db(dbClient.database).collection('files');
    // Retrieving the token's userId value and search for the user
    const token = req.headers['x-token'];
    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const user = await users.findOne({ _id: new ObjectID(userId) });
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // if a User is found we retrieve the post request's form fields values
    const { name, type, data } = req.body;
    let { parentId, isPublic } = req.body;
    // checking required fields availability and validating the values
    const validFileTypes = ['folder', 'file', 'image'];
    if (!name) {
      return res.status(400).json({ error: 'Missing name' });
    }
    if (!type || !validFileTypes.includes(type)) {
      return res.status(400).json({ error: 'Missing type' });
    }
    if (!data && type !== 'folder') {
      return res.status(400).json({ error: 'Missing data' });
    }
    if (parentId) {
      const file = await files.findOne({ _id: new ObjectID(parentId) });
      if (!file) {
        return res.status(400).json({ error: 'Parent not found' });
      }
      if (file.type !== 'folder') {
        return res.status(400).json({ error: 'Parent is not a folder' });
      }
    }
    // we set default value to isPublic to false if no value passed
    if (parentId) {
      parentId = ObjectID(parentId);
    } else {
      parentId = 0;
    }
    isPublic = isPublic || false;
    // inserting the folder in the files collection if type is folder
    if (type === 'folder') {
      const insertFile = await files.insertOne({
        userId: ObjectID(userId),
        name,
        type,
        isPublic,
        parentId,
      });
      return res.status(201).json({
        id: insertFile.insertedId,
        userId,
        name,
        type,
        isPublic,
        parentId,
      });
    }
    // Otherwise type is equal to images or file
    const folderPath = env.FOLDER_PATH ? env.FOLDER_PATH : '/tmp/files_manager';
    const fileName = uuidv4();
    const filePath = `${folderPath}/${fileName}`;
    const content = Buffer.from(data, 'base64').toString();
    // Create Folder if not exist and then create and save the content in file
    // Specifying recursive: true so it will only add the missing folders
    fs.mkdir(folderPath, { recursive: true }, (err) => {
      if (err) {
        console.error(err);
      } else {
        fs.writeFile(filePath, content, 'utf-8', (err) => {
          if (err) {
            console.error(err);
          }
        });
      }
    });
    const insertFile = await files.insertOne({
      userId: ObjectID(userId),
      name,
      type,
      isPublic,
      parentId: ObjectID(parentId) ? parentId : 0,
      localPath: filePath,
    });
    return res.status(201).json({
      id: insertFile.insertedId,
      userId,
      name,
      type,
      isPublic,
      parentId,
    });
  }

  static async getShow(req, res) {
    const token = req.headers['x-token'];
    const users = dbClient.client.db(dbClient.database).collection('users');
    const files = dbClient.client.db(dbClient.database).collection('files');

    // Checking user availability
    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const user = await users.findOne({ _id: ObjectID(userId) });
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // searching for a file based on users Id and file id req parameter
    const { id } = req.params;
    const file = await files.findOne({
      userId: ObjectID(userId),
      _id: ObjectID(id),
    });
    if (!file) {
      return res.status(404).json({ error: 'Not found' });
    }
    return res.status(200).json({
      id: file._id,
      userId,
      name: file.name,
      type: file.type,
      isPublic: file.isPublic,
      parentId: file.parentId,
    });
  }

  static async getIndex(req, res) {
    const token = req.headers['x-token'];
    const users = dbClient.client.db(dbClient.database).collection('users');
    const filesColl = dbClient.client.db(dbClient.database).collection('files');

    // Checking user availability
    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const user = await users.findOne({ _id: ObjectID(userId) });
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    // Query the parentId and page from request url
    const { parentId } = req.query;
    let { page } = req.query;
    page = page || 0;

    // Defining a pipeline for our pagination functionality
    let pipeline;
    let files;
    if (parentId) {
      pipeline = [
        { $match: { parentId: ObjectID(parentId) } },
        { $skip: page * 20 },
        { $limit: 20 },
      ];
      files = await filesColl.aggregate(pipeline).toArray();
    } else {
      pipeline = [{ $skip: page * 20 }, { $limit: 20 }];
      files = await filesColl.aggregate(pipeline).toArray();
    }
    const filesRespList = [];
    if (files.length === 0) {
      return res.status(200).json([]);
    }
    files.forEach((file) => {
      filesRespList.push({
        id: file._id,
        userId: file.userId,
        name: file.name,
        type: file.type,
        isPublic: file.isPublic,
        parentId: file.parentId,
      });
    });
    return res.status(200).json(filesRespList);
  }

  static async putPublish(req, res) {
    const token = req.headers['x-token'];
    const users = dbClient.client.db(dbClient.database).collection('users');
    const filesColl = dbClient.client.db(dbClient.database).collection('files');

    // Checking user availability
    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const user = await users.findOne({ _id: ObjectID(userId) });
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    // searching for a file based on users Id and file id req parameter
    const { id } = req.params;
    let file = await filesColl.findOne({
      userId: ObjectID(userId),
      _id: ObjectID(id),
    });
    if (!file) {
      return res.status(404).json({ error: 'Not found' });
    }

    await filesColl.updateOne(
      { _id: ObjectID(id) },
      { $set: { isPublic: true } },
    );
    file = await filesColl.findOne({
      userId: ObjectID(userId),
      _id: ObjectID(id),
    });
    return res.status(200).json({
      id: file._id,
      userId: file.userId,
      name: file.name,
      type: file.type,
      isPublic: file.isPublic,
      parentId: file.parentId,
    });
  }

  static async putUnpublish(req, res) {
    const token = req.headers['x-token'];
    const users = dbClient.client.db(dbClient.database).collection('users');
    const filesColl = dbClient.client.db(dbClient.database).collection('files');

    // Checking user availability
    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const user = await users.findOne({ _id: ObjectID(userId) });
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    // searching for a file based on users Id and file id req parameter
    const { id } = req.params;
    let file = await filesColl.findOne({
      userId: ObjectID(userId),
      _id: ObjectID(id),
    });
    if (!file) {
      return res.status(404).json({ error: 'Not found' });
    }

    await filesColl.updateOne(
      { _id: ObjectID(id) },
      { $set: { isPublic: false } },
    );
    file = await filesColl.findOne({
      userId: ObjectID(userId),
      _id: ObjectID(id),
    });
    return res.status(200).json({
      id: file._id,
      userId: file.userId,
      name: file.name,
      type: file.type,
      isPublic: file.isPublic,
      parentId: file.parentId,
    });
  }

  static async getFile(req, res) {
    const token = req.headers['x-token'];
    const { id } = req.params;

    const filesColl = dbClient.client.db(dbClient.database).collection('files');

    const userId = await redisClient.get(`auth_${token}`);

    const file = await filesColl.findOne({ _id: ObjectID(id) });
    if (!file) {
      return res.status(404).json({ error: 'Not found' });
    }

    // If file is not public and no user authenticated or the userId is
    // not the same As the files
    if (!file.isPublic && (!userId || file.userId.toString() !== userId)) {
      return res.status(404).json({ error: 'Not found' });
    }

    if (file.type === 'folder') {
      return res.status(400).json({ error: 'A folder doesn\'t have content' });
    }

    // check if localPath of the file exists
    const asyncAccess = promisify(fs.access);
    try {
      await asyncAccess(file.localPath, fs.constants.F_OK);
    } catch (err) {
      return res.status(404).json({ error: 'Not found' });
    }

    // Reading the content from the file if exists
    const asyncReadFile = promisify(fs.readFile);
    const fileContent = await asyncReadFile(file.localPath, 'utf-8');

    // Defining Content Type using the mime module
    const fileType = mime.lookup(file.name);

    res.status(200).setHeader('Content-Type', fileType);
    return res.send(fileContent);
  }
}

module.exports = FilesController;
