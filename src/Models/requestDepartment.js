module.exports = (sequelize, DataTypes) => {
  return sequelize.define('RequestDepartment', {
    id: {
      type: DataTypes.INTEGER, 
      primaryKey: true, 
      autoIncrement: true,
    },
    request_id: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    dept_id: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  }, {
    tableName: 'request_departments',
    timestamps: false,
  });
};