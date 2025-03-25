const express = require("express");
const http = require("http");
const mongoose = require("mongoose");

const cors = require("cors");
const dotenv = require("dotenv");
const morgan = require("morgan");

// Import routes

const productRouter = require("./routers/product");
const categoryRouter = require("./routers/category");
const authRouter = require("./routers/auth.router");


// Database connection
const { connectDB } = require("./config/db");
 
 dotenv.config();
 const app = express();
 app.use(cors());
 app.use(express.json());
 app.use(morgan("dev"));
 
// const server = http.createServer(app);
 
 
 connectDB(process.env.DB_URI);
 
 // Routes
 app.use("/api", productRouter);
 app.use("/api", categoryRouter);
 app.use("/api", authRouter);
 
 
 // Start servers
 const appPort = 8000;
 app.listen(appPort, () => {
   console.log(`App running on http://localhost:${appPort}`);
 });