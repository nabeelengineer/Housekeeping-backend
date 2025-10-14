'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const tableName = 'rental_odometer_reads';
    let exists = false;
    try {
      await queryInterface.describeTable(tableName);
      exists = true;
    } catch (e) {
      exists = false;
    }

    if (!exists) {
      await queryInterface.createTable(tableName, {
        id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
        rental_id: { type: Sequelize.INTEGER, allowNull: false, unique: true },
        vehicle_id: { type: Sequelize.INTEGER, allowNull: false },
        start_km: { type: Sequelize.DECIMAL(10,2), allowNull: false },
        start_image_url: { type: Sequelize.STRING, allowNull: true },
        start_captured_at: { type: Sequelize.DATE, allowNull: false },
        start_captured_by: { type: Sequelize.STRING, allowNull: false },
        end_km: { type: Sequelize.DECIMAL(10,2), allowNull: true },
        end_image_url: { type: Sequelize.STRING, allowNull: true },
        end_captured_at: { type: Sequelize.DATE, allowNull: true },
        end_captured_by: { type: Sequelize.STRING, allowNull: true },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
        updated_at: { type: Sequelize.DATE, allowNull: true },
      });
    }

    // Add named indexes if they don't already exist
    const indexes = await queryInterface.showIndex(tableName);
    const names = new Set((indexes || []).map((i) => i.name));

    if (!names.has('idx_ror_start_captured_at')) {
      await queryInterface.addIndex(tableName, ['start_captured_at'], { name: 'idx_ror_start_captured_at' });
    }
    if (!names.has('idx_ror_end_captured_at')) {
      await queryInterface.addIndex(tableName, ['end_captured_at'], { name: 'idx_ror_end_captured_at' });
    }
    // Skip vehicle_id index to avoid duplicates in environments where it may already exist
  },

  async down(queryInterface) {
    const tableName = 'rental_odometer_reads';
    try {
      await queryInterface.dropTable(tableName);
    } catch (e) {
      // ignore
    }
  }
};
