module.exports = (sequelize, DataTypes) => {
  const RentalLog = sequelize.define('RentalLog', {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    vehicle_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    renter_id: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    rented_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    returned_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  }, {
    tableName: 'rental_logs',
    timestamps: false,
    indexes: [
      { fields: ['vehicle_id'] },
      { fields: ['renter_id'] },
      { fields: ['rented_at'] },
    ],
  });

  return RentalLog;
};
