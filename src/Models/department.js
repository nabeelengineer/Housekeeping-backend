module.exports = (sequelize, DataTypes) => {
  return sequelize.define('Department', {
    dept_id: {
      type: DataTypes.STRING,
      primaryKey: true,
      allowNull: false
    },
    dept_name: {
      type: DataTypes.STRING,
      allowNull: false
    }
    }, {
      timestamps: false,
      tableName: 'departments'
  });
};