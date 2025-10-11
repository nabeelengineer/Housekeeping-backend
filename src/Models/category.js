module.exports = (sequelize, DataTypes) => {
  return sequelize.define('Category', {
    category_id: {
      type: DataTypes.STRING,
      primaryKey: true,
      allowNull: false,
    },
    category_name: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    }
  }, {
    tableName: 'categories',
    timestamps: false,
  });
};
