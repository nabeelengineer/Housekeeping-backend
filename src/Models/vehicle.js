module.exports = (sequelize, DataTypes) => {
  const Vehicle = sequelize.define('Vehicle', {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    type: {
      type: DataTypes.ENUM('car', 'scooter', 'bike'),
      allowNull: false,
    },
    plate: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    image_url: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM('available', 'rented', 'maintenance'),
      allowNull: false,
      defaultValue: 'available',
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
  }, {
    tableName: 'vehicles',
    timestamps: false,
    indexes: [
      { unique: true, fields: ['plate'] },
      { fields: ['status'] },
      { fields: ['type'] },
    ],
  });

  return Vehicle;
};
