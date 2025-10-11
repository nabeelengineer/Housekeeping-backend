module.exports = (sequelize, DataTypes) => {
  return sequelize.define('Request', {
    request_id: {
      type: DataTypes.STRING,
      primaryKey: true,
      allowNull: false,
    },
    employee_id: {
      type: DataTypes.STRING, 
      allowNull: false,
    },
    type: {
      type: DataTypes.ENUM('complaint', 'requirement'), 
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT, 
      allowNull: true,
    },
    floor: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    unit: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM('pending', 'in_progress', 'resolved', 'closed'), 
      allowNull: false,
      defaultValue: 'pending',
    },
    created_at: {
      type: DataTypes.DATE, 
      allowNull: false, 
      defaultValue: DataTypes.NOW,
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    closed_date: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    priority: {
      type: DataTypes.ENUM('low', 'medium', 'high'),
      allowNull: false,
      defaultValue: 'low',
    },
    assigned_to: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  }, {
    tableName: 'requests',
    timestamps: false,
  });
};