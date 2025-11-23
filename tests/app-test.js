require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const todoTaskRouter = require("../routers/todoTaskRouter");
const userRouter = require("../routers/userRouter");
const tourRouter = require("../routers/tourRouter");
const {
  unknownEndpoint,
  errorHandler,
} = require("../middleware/customMiddleware");

// express app
const app = express();

// Middleware to parse JSON
app.use(express.json());

app.get("/", (req, res) => res.send("API Running!"));

app.use("/api/todoTasks", todoTaskRouter);
app.use("/api/users", userRouter);
app.use("/api/tours", tourRouter);

app.use(unknownEndpoint);
app.use(errorHandler);


mongoose
  .connect("mongodb://localhost:27017/test-db")
  .then(() => {
    console.log("connected to db");
  })
  .catch((error) => {
    console.error(error);
  });

module.exports = app;
