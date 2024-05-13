const express = require('express');
const { env } = require('process');
const routes = require('./routes/index');

const app = express();
const port = env.PORT ? env.PORT : 5000;

// Decoding the post request data
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/', routes);

app.listen(port, () => {
  console.log(`Server Running on port: ${port}`);
});
