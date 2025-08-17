exports.shorthands = undefined;

/**
 * @param {import("node-pg-migrate/dist/types").MigrationBuilder} pgm
 */
exports.up = pgm => {
  // This command enables the pg_vector extension in your database.
  pgm.createExtension('vector', {
    ifNotExists: true,
  });
};

/**
 * @param {import("node-pg-migrate/dist/types").MigrationBuilder} pgm
 */
exports.down = pgm => {
  // This command would disable the extension if you ever needed to reverse the migration.
  pgm.dropExtension('vector');
};
