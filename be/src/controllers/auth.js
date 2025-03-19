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
// Lấy tất cả người dùng
const getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select("-password"); // Loại bỏ password

    if (!users.length) {
      return sendErrorResponse(res, 404, "Không tìm thấy người dùng");
    }

    res.status(200).json({
      message: "Lấy danh sách người dùng thành công",
      users,
    });
  } catch (error) {
    console.error(error);
    sendErrorResponse(res, 500, "Lỗi khi lấy danh sách người dùng");
  }
};

// Lấy thông tin người dùng
const getUserInfo = async (req, res) => {
  const userId = req.headers["user-id"];
  if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
    return sendErrorResponse(res, 400, "userId không hợp lệ");
  }

  try {
    const user = await User.findById(userId).select("-password");
    if (!user) return sendErrorResponse(res, 404, "Người dùng không tồn tại");

    res.status(200).json({ message: "Lấy thông tin thành công", user });
  } catch (error) {
    console.error(error);
    sendErrorResponse(res, 500, "Lỗi khi lấy thông tin người dùng");
  }
};

// Cập nhật mật khẩu người dùng
const updateAccount = async (req, res) => {
  const { userId } = req.params;
  const { oldPassword, newPassword, confirmPassword } = req.body;

  if (!newPassword || newPassword.length < 6) {
    return sendErrorResponse(res, 400, "Mật khẩu mới phải có ít nhất 6 ký tự");
  }
  if (newPassword !== confirmPassword) {
    return sendErrorResponse(res, 400, "Mật khẩu xác nhận không khớp");
  }

  try {
    const user = await User.findById(userId);
    if (!user) return sendErrorResponse(res, 404, "Người dùng không tồn tại");

    if (!(await bcryptjs.compare(oldPassword, user.password))) {
      return sendErrorResponse(res, 400, "Mật khẩu cũ không chính xác");
    }

    user.password = await bcryptjs.hash(newPassword, 10);
    await user.save();

    res.status(200).json({ message: "Cập nhật mật khẩu thành công" });
  } catch (error) {
    console.error(error);
    sendErrorResponse(res, 500, "Lỗi khi cập nhật mật khẩu");
  }
};

// Xác minh mật khẩu cũ
const verifyOldPassword = async (req, res) => {
  const { userId, oldPassword } = req.body;
  if (!userId || !oldPassword) {
    return sendErrorResponse(res, 400, "userId và oldPassword là bắt buộc");
  }

  try {
    const user = await User.findById(userId);
    if (!user) return sendErrorResponse(res, 404, "Người dùng không tồn tại");

    const isMatch = await bcryptjs.compare(oldPassword, user.password);
    if (!isMatch) return sendErrorResponse(res, 400, "Mật khẩu cũ không chính xác");

    res.status(200).json({ message: "Mật khẩu cũ chính xác" });
  } catch (error) {
    console.error(error);
    sendErrorResponse(res, 500, "Lỗi khi xác minh mật khẩu cũ");
  }
};

// Cập nhật thông tin người dùng
const updateUser = async (req, res) => {
  const userId = req.user?.id || req.body.userId;
  if (!userId) return sendErrorResponse(res, 400, "User ID không được cung cấp");

  const { username, email, phone } = req.body;
  if (!username && !email && !phone) {
    return sendErrorResponse(res, 400, "Không có thông tin để cập nhật");
  }

  const errors = {};
  const validateRegex = {
    username: /^[a-zA-Z0-9_]{1,10}$/,
    email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    phone: /^[0-9]{10,11}$/,
  };

  if (username && !validateRegex.username.test(username)) {
    errors.username = "Tên chỉ chứa chữ cái, số và dấu gạch dưới (tối đa 10 ký tự)";
  }
  if (email && !validateRegex.email.test(email)) {
    errors.email = "Email không hợp lệ";
  }
  if (phone && !validateRegex.phone.test(phone)) {
    errors.phone = "Số điện thoại không hợp lệ (10-11 chữ số)";
  }

  if (Object.keys(errors).length) return res.status(400).json({ errors });

  try {
    const user = await User.findById(userId);
    if (!user) return sendErrorResponse(res, 404, "Không tìm thấy người dùng");

    const checkUniqueField = async (field, value, message) => {
      if (value) {
        const exists = await User.findOne({ [field]: value, _id: { $ne: userId } });
        if (exists) return sendErrorResponse(res, 400, message, field);
        user[field] = value;
      }
    };

    await checkUniqueField("username", username, "Tên người dùng đã tồn tại");
    await checkUniqueField("email", email, "Email đã được sử dụng");
    await checkUniqueField("phone", phone, "Số điện thoại đã được sử dụng");

    const updatedUser = await user.save();
    res.status(200).json({ message: "Cập nhật thành công", data: updatedUser });
  } catch (error) {
    console.error(error);
    sendErrorResponse(res, 500, "Lỗi khi cập nhật thông tin người dùng");
  }
};

module.exports = {
  signin,
  signup,
  requestResetPassword,
  processResetPassword,
  updatePassword,
  getAllUsers,
  getUserInfo,
  updateAccount,
  verifyOldPassword,
  updateUser,

};
