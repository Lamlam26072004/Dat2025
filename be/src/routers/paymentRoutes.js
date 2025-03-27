const express = require("express");
const router = express.Router();
const paymentController = require("../controllers/paymentController");


router.post(
  "/update-payment-status",
  paymentController.updatePaymentStatusOnFailure
);

module.exports = router;