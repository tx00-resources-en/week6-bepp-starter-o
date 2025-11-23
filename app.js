require("dotenv").config();
const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");
const {requestLogger,unknownEndpoint,errorHandler} = require("./middleware/customMiddleware");
const todoTaskRouter = require("./routers/todoTaskRouter");
const userRouter = require("./routers/userRouter");
const tourRouter = require("./routers/tourRouter");

// express app
const app = express();

connectDB();

// middleware
app.use(cors());
app.use(express.json());

app.use(requestLogger);

app.get("/", (req, res) => res.send("API Running!"));

app.use("/api/todoTasks", todoTaskRouter);
app.use("/api/users", userRouter);
app.use("/api/tours", tourRouter);

app.use(unknownEndpoint);
app.use(errorHandler);

const port = process.env.PORT || 4000;
app.listen(port, () =>
  console.log(`Server is running on http://localhost:${port}`)
);
