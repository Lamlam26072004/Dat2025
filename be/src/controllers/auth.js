const bcryptjs = require("bcryptjs");
const { registerSchema, signinSchema } = require("../schemas/auth");
const User = require("../models/user");
const jwt = require("jsonwebtoken");
const Mail = require("../helpers/node-mailler");
const mongoose = require("mongoose");

const signup = async (req, res) => {
  try {
    // Lấy dữ liệu từ client gửi lên: req.body
    const { username, email, password, confirmPassword, avatar, phone } =
      req.body;

    // Kiểm tra username không chứa dấu hoặc ký tự đặc biệt và không vượt quá 10 ký tự
    const usernameRegex = /^[a-zA-Z0-9_]+$/; // Chỉ cho phép chữ, số và dấu gạch dưới
    if (!usernameRegex.test(username)) {
      return res.status(400).json({
        field: "username",
        message: "Tên người dùng không được chứa dấu hoặc ký tự đặc biệt!",
      });
    }
    if (username.length > 10) {
      return res.status(400).json({
        field: "username",
        message: "Tên người dùng không được vượt quá 10 ký tự!",
      });
    }

    // Kiểm tra định dạng số điện thoại
    const phoneRegex = /^[0-9]{10,11}$/; // Chỉ cho phép số, độ dài từ 10-11
    if (!phoneRegex.test(phone)) {
      return res.status(400).json({
        field: "phone",
        message: "Số điện thoại không hợp lệ! Phải chứa 10-11 chữ số.",
      });
    }

    // Kiểm tra dữ liệu từ client gửi lên có đúng với schema không
    const { error } = registerSchema.validate(req.body, { abortEarly: false });
    if (error) {
      const messages = error.details.map(({ message }) => message);
      return res.status(400).json({
        messages,
      });
    }

    // Kiểm tra username đã tồn tại
    const existingUsername = await User.findOne({ username });
    if (existingUsername) {
      return res.status(400).json({
        field: "username",
        message: "Tên người dùng đã được sử dụng",
      });
    }

    // Kiểm tra email đã tồn tại
    const existingEmail = await User.findOne({ email });
    if (existingEmail) {
      return res.status(400).json({
        field: "email",
        message: "Email đã được sử dụng",
      });
    }

    // Kiểm tra phone đã tồn tại
    const existingPhone = await User.findOne({ phone });
    if (existingPhone) {
      return res.status(400).json({
        field: "phone",
        message: "Số điện thoại đã được sử dụng",
      });
    }

    // Mã hóa password
    const hashPassword = await bcryptjs.hash(password, 10);
    const role = (await User.countDocuments({})) === 0 ? "admin" : "user";

    // Tạo mới user
    const user = await User.create({
      username,
      email,
      password: hashPassword,
      avatar,
      role,
      phone,
    });

    const token = jwt.sign({ userId: user._id }, "123456", { expiresIn: "1h" });

    // Trả về client thông tin user vừa tạo
    user.password = undefined;
    return res.status(201).json({
      message: "Đăng ký thành công",
      user,
      token,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Đã xảy ra lỗi máy chủ. Vui lòng thử lại sau.",
    });
  }
};

const signin = async (req, res) => {
  try {
    // Lấy dữ liệu từ client gửi lên : req.body
    const { email, password } = req.body;

    // Kiểm tra dữ liệu từ client gửi lên có đúng với schema không
    const { error } = signinSchema.validate(req.body, { abortEarly: false });
    if (error) {
      const messages = error.details.map((error) => error.message);
      return res.status(400).json({
        field: "validation",
        messages,
      });
    }

    // Kiểm tra email có tồn tại trong DB không
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({
        field: "email",
        message: "Email chưa được đăng ký",
      });
    }

    // So sánh mật khẩu từ client gửi lên với mật khẩu trong DB
    const isMatch = await bcryptjs.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({
        field: "password",
        message: "Mật khẩu không đúng",
      });
    }

    // Nếu khớp thì tạo token và trả về client
    const token = jwt.sign({ userId: user._id }, "123456", { expiresIn: "1h" });

    // Xóa mật khẩu trước khi trả về client
    user.password = undefined;

    return res.status(200).json({
      message: "Đăng nhập thành công",
      user,
      token,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Đã xảy ra lỗi trên máy chủ. Vui lòng thử lại sau.",
    });
  }
};

let EMAIL = null;

const requestResetPassword = async (req, res) => {
  // get email ( user nhập vào email)
  try {
    const { email } = req.body;
    // check email có tôn tại trên hệ thống
    const accounts = await User.find();
    const emails = accounts.map((acc) => acc.email);

    if (!emails.includes(email)) res.json("Invalid Email");

    EMAIL = email;

    // create token
    const resetPasswordToken = jwt.sign(
      {
        data: "resetpassword",
      },
      "SECRET",
      {
        expiresIn: 60,
      }
    );
    // send email with code
    if (!resetPasswordToken) return;
    const messageId = Mail.sendResetPassword(email, resetPasswordToken);
    res.json(messageId);
  } catch (error) {
    console.log(error);
  }
};

const processResetPassword = async (req, res) => {
  const { code } = req.body;
  if (!code) return;

  // check expires code
  try {
    const decoded = jwt.verify(code, "SECRET");
    res.json("Token Valid");
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      res.json({
        message: "Token expired",
      });
    } else {
      res.json("Token is invalid:", error.message);
    }
  }
};
const updatePassword = async (req, res) => {
  const { newPassword } = req.body;
  if (!newPassword) return;
  try {
    // mã hóa password
    const hashPassword = await bcryptjs.hash(newPassword, 10);
    // tạo mới user
    const result = await User.updateOne(
      { email: EMAIL },
      { password: hashPassword }
    );

    if (result.modifiedCount > 0) {
      res.json("Reset password success!");
    } else {
      res.json("No user found with this email.");
    }
  } catch (error) {
    res.json("error while hash new password");
  }
};


module.exports = {
  signin,
  signup,
  requestResetPassword,
  processResetPassword,
  updatePassword

};
