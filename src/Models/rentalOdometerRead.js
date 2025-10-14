module.exports = (sequelize, DataTypes) => {
  const RentalOdometerRead = sequelize.define(
    'RentalOdometerRead',
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      rental_id: { type: DataTypes.INTEGER, allowNull: false, unique: true },
      vehicle_id: { type: DataTypes.INTEGER, allowNull: false },
      start_km: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
      start_image_url: { type: DataTypes.STRING, allowNull: true },
      start_captured_at: { type: DataTypes.DATE, allowNull: false },
      start_captured_by: { type: DataTypes.STRING, allowNull: false },
      end_km: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
      end_image_url: { type: DataTypes.STRING, allowNull: true },
      end_captured_at: { type: DataTypes.DATE, allowNull: true },
      end_captured_by: { type: DataTypes.STRING, allowNull: true },
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updated_at: { type: DataTypes.DATE, allowNull: true },
    },
    {
      tableName: 'rental_odometer_reads',
      timestamps: false,
      indexes: [
        { fields: ['vehicle_id'] },
        { fields: ['start_captured_at'] },
        { fields: ['end_captured_at'] },
      ],
    }
  );

  return RentalOdometerRead;
};
