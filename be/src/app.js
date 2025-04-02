const express = require("express");
const http = require("http");
const mongoose = require("mongoose");

const cors = require("cors");
const dotenv = require("dotenv");
const morgan = require("morgan");

// Import routes

const productRouter = require("./routers/product");
const categoryRouter = require("./routers/category");
const cartRouter = require("./routers/cart");
const authRouter = require("./routers/auth.router");
const customerRoutes = require("./routers/customerRoutes");
const paymentRoutes = require("./routers/paymentRoutes");
const orderRouter = require("./routers/order");
const blogRoutes = require("./routers/blog");
const commentRouter = require("./routers/comment");
const couponRoutes = require("./routers/coupon");
const locationRoutes = require("./routers/address");



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
 app.use("/api", customerRoutes);
 app.use("/api", paymentRoutes);
 app.use("/api", cartRouter);
 app.use("/api", orderRouter);
 app.use("/api", blogRoutes);
 app.use("/api", commentRouter);
 app.use("/api", couponRoutes);
 app.use("/api", locationRoutes);
 
 
 // Start servers
 const appPort = 8000;
 app.listen(appPort, () => {
   console.log(`App running on http://localhost:${appPort}`);
 });