const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { Employee } = require('../Models');
require('dotenv').config();

// Signup (register) new employee
router.post('/signup', async (req, res) => {
  try {
    const { employee_id, name, phone_no, email, password, confirm_password, department_id = null, manager_id = null } = req.body;
    if (!employee_id || !name || !phone_no || !email || !password || !confirm_password) {
      return res.status(400).json({ error: 'All fields are required' });
    }
    if (password !== confirm_password) return res.status(400).json({ error: 'Passwords do not match' });

    const exists = await Employee.findOne({ where: { employee_id } });
    if (exists) return res.status(409).json({ error: 'Employee ID already registered' });

    const emailTaken = await Employee.findOne({ where: { email } });
    if (emailTaken) return res.status(409).json({ error: 'Email already registered' });

    const phoneTaken = await Employee.findOne({ where: { phone_no } });
    if (phoneTaken) return res.status(409).json({ error: 'Phone number already registered' });

    const hashed = await bcrypt.hash(password, 10);
    await Employee.create({ employee_id, name, phone_no, email, password: hashed, department_id, manager_id, role: 'employee' });
    return res.status(201).json({ message: 'Registered successfully' });
  } catch (error) {
    return res.status(500).json({ error: 'Error registering employee' });
  }
});

// Login with employee_id and password
router.post('/login', async (req, res) => {
  try {
    const { employee_id, password } = req.body;
    if (!employee_id || !password) return res.status(400).json({ error: 'employee_id and password are required' });
    const employee = await Employee.findOne({ where: { employee_id } });
    if (!employee) return res.status(400).json({ error: 'Invalid credentials' });
    const ok = await bcrypt.compare(password, employee.password);
    if (!ok) return res.status(400).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ employee_id: employee.employee_id, role: employee.role }, process.env.JWT_SECRET, { expiresIn: '1h' });
    return res.json({ token });
  } catch (error) {
    return res.status(500).json({ error: 'Error logging in' });
  }
});

// Request OTP for password reset
router.post('/forgot/request-otp', async (req, res) => {
  try {
    const { phone_no } = req.body;
    if (!phone_no) return res.status(400).json({ error: 'phone_no is required' });
    const employee = await Employee.findOne({ where: { phone_no } });
    if (!employee) return res.status(404).json({ error: 'Phone number not found' });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
    employee.otp_code = otp;
    employee.otp_expires_at = expires;
    await employee.save();

    // TODO: integrate SMS gateway; for now, return OTP for testing
    return res.json({ message: 'OTP sent', otp });
  } catch (error) {
    return res.status(500).json({ error: 'Error generating OTP' });
  }
});

// Verify OTP and reset password
router.post('/forgot/verify', async (req, res) => {
  try {
    const { phone_no, otp_code, new_password, confirm_password } = req.body;
    if (!phone_no || !otp_code || !new_password || !confirm_password) {
      return res.status(400).json({ error: 'All fields are required' });
    }
    if (new_password !== confirm_password) return res.status(400).json({ error: 'Passwords do not match' });
    const employee = await Employee.findOne({ where: { phone_no } });
    if (!employee || !employee.otp_code || !employee.otp_expires_at) return res.status(400).json({ error: 'OTP not requested' });
    if (employee.otp_code !== otp_code) return res.status(400).json({ error: 'Invalid OTP' });
    if (new Date(employee.otp_expires_at).getTime() < Date.now()) return res.status(400).json({ error: 'OTP expired' });

    employee.password = await bcrypt.hash(new_password, 10);
    employee.otp_code = null;
    employee.otp_expires_at = null;
    await employee.save();
    return res.json({ message: 'Password updated successfully' });
  } catch (error) {
    return res.status(500).json({ error: 'Error resetting password' });
  }
});

module.exports = router;