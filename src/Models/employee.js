module.exports = (sequelize, DataTypes) => {
  const Employee = sequelize.define('Employee', {
    employee_id: {
      type: DataTypes.STRING,
      primaryKey: true,
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING, 
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING, 
      allowNull: false, 
      unique: true,
    },
    phone_no: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    password: {
      type: DataTypes.STRING, 
      allowNull: false,
    },
    role: {
      type: DataTypes.ENUM('employee', 'admin', 'staff', 'it_admin'), 
      allowNull: false, 
      defaultValue: 'employee',
    },
    department_id: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    manager_id: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    otp_code: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    otp_expires_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    created_at: {
      type: DataTypes.DATE, 
      allowNull: false, 
      defaultValue: DataTypes.NOW,
    },
}, {
    tableName: 'employees',
    timestamps: false,
  });

return Employee;
}