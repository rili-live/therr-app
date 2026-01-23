/**
 * Seed file for the categories table
 * Run with: npm run seeds:run (from messages-service directory)
 *
 * Uses ON CONFLICT DO NOTHING to gracefully handle existing data in all environments.
 * If the data already exists, it will be skipped without error.
 */

const categories = [
    {
        tag: 'business',
        name: 'business',
        iconGroup: 'font-awesome-5',
        iconId: 'briefcase',
        iconColor: '#f9ad2a',
    },
    {
        tag: 'food',
        name: 'food',
        iconGroup: 'therr',
        iconId: 'utensils',
        iconColor: '#143b54',
    },
    {
        tag: 'general',
        name: 'general',
        iconGroup: 'font-awesome-5',
        iconId: 'star',
        iconColor: '#ffc269',
    },
    {
        tag: 'movies',
        name: 'movies',
        iconGroup: 'font-awesome-5',
        iconId: 'video',
        iconColor: '#ebc300',
    },
    {
        tag: 'music',
        name: 'music',
        iconGroup: 'therr',
        iconId: 'music',
        iconColor: '#143b54',
    },
    {
        tag: 'science',
        name: 'science',
        iconGroup: 'material-icons',
        iconId: 'science',
        iconColor: '#388254',
    },
    {
        tag: 'sports',
        name: 'sports',
        iconGroup: 'font-awesome-5',
        iconId: 'futbol',
        iconColor: '#363636',
    },
    {
        tag: 'tech',
        name: 'tech',
        iconGroup: 'font-awesome-5',
        iconId: 'rocket',
        iconColor: '#f9ad2a',
    },
];

exports.seed = async (knex) => {
    // Insert all categories with ON CONFLICT DO NOTHING to gracefully handle existing data
    const results = await Promise.all(
        categories.map((category) => knex.raw(`
                INSERT INTO main.categories (tag, name, "iconGroup", "iconId", "iconColor")
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT (tag) DO NOTHING
            `, [
            category.tag,
            category.name,
            category.iconGroup,
            category.iconId,
            category.iconColor,
        ])),
    );

    const inserted = results.filter((r) => r.rowCount > 0).length;
    const skipped = results.length - inserted;

    // eslint-disable-next-line no-console
    console.log(`Categories seed complete: ${inserted} inserted, ${skipped} skipped (already exist)`);
};
