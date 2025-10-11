module.exports = (sequelize, DataTypes) => {
  return sequelize.define('RequestCategory', {
    id: {
      type: DataTypes.INTEGER, 
      primaryKey: true,
      autoIncrement: true,
    },
    category_id: {
      type: DataTypes.STRING, 
      allowNull: false,
    },
    request_id: {
      type: DataTypes.STRING, 
      allowNull: false,
    },
  }, {
    tableName: 'request_categories',
    timestamps: false,
  });
}