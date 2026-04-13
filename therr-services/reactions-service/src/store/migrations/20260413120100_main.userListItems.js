exports.up = async (knex) => {
    // 1) Create the junction table
    await knex.schema.withSchema('main').createTable('userListItems', (table) => {
        table.uuid('id').notNullable().defaultTo(knex.raw('uuid_generate_v4()'));
        table.uuid('listId').notNullable();
        table.uuid('contentId').notNullable();
        table.string('contentType', 24).notNullable().defaultTo('space');
        table.integer('position').notNullable().defaultTo(0);
        table.timestamp('addedAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());

        table.primary(['id']);
        table.unique(['listId', 'contentId', 'contentType'], 'uniq_userlistitems_list_content');
        table.index(['listId'], 'idx_userlistitems_listid');
        table.index(['contentId', 'contentType'], 'idx_userlistitems_content');
        table.foreign('listId').references('id').inTable('main.userLists').onDelete('CASCADE');
    });

    // 2) Backfill userLists from existing spaceReactions.userBookmarkCategory
    //    One list per (userId, userBookmarkCategory)
    await knex.raw(`
        INSERT INTO main."userLists" ("userId", "name", "isDefault", "itemCount", "createdAt", "updatedAt")
        SELECT sr."userId",
               COALESCE(NULLIF(TRIM(sr."userBookmarkCategory"), ''), 'Saved') AS name,
               CASE WHEN LOWER(COALESCE(sr."userBookmarkCategory", '')) IN ('uncategorized', 'saved') THEN true ELSE false END AS "isDefault",
               COUNT(*) AS "itemCount",
               NOW(),
               NOW()
        FROM main."spaceReactions" sr
        WHERE sr."userBookmarkCategory" IS NOT NULL
        GROUP BY sr."userId", COALESCE(NULLIF(TRIM(sr."userBookmarkCategory"), ''), 'Saved'),
                 CASE WHEN LOWER(COALESCE(sr."userBookmarkCategory", '')) IN ('uncategorized', 'saved') THEN true ELSE false END
        ON CONFLICT DO NOTHING
    `);

    // 3) Ensure every user with bookmarks has a default "Saved" list.
    //    If they already have a list derived from 'Uncategorized', mark it as default
    //    (handled above). If they only have custom categories, create a "Saved" list.
    await knex.raw(`
        INSERT INTO main."userLists" ("userId", "name", "isDefault", "itemCount", "createdAt", "updatedAt")
        SELECT DISTINCT sr."userId", 'Saved', true, 0, NOW(), NOW()
        FROM main."spaceReactions" sr
        WHERE sr."userBookmarkCategory" IS NOT NULL
          AND NOT EXISTS (
              SELECT 1 FROM main."userLists" ul
              WHERE ul."userId" = sr."userId" AND ul."isDefault" = true
          )
        ON CONFLICT DO NOTHING
    `);

    // 4) Backfill userListItems: link each existing bookmark reaction to its list
    await knex.raw(`
        INSERT INTO main."userListItems" ("listId", "contentId", "contentType", "position", "addedAt")
        SELECT ul."id",
               sr."spaceId",
               'space',
               COALESCE(sr."userBookmarkPriority", 0),
               sr."updatedAt"
        FROM main."spaceReactions" sr
        JOIN main."userLists" ul
          ON ul."userId" = sr."userId"
         AND LOWER(ul."name") = LOWER(COALESCE(NULLIF(TRIM(sr."userBookmarkCategory"), ''), 'Saved'))
        WHERE sr."userBookmarkCategory" IS NOT NULL
        ON CONFLICT DO NOTHING
    `);

    // 5) Refresh itemCount on userLists from the junction table
    await knex.raw(`
        UPDATE main."userLists" ul
        SET "itemCount" = COALESCE(sub.cnt, 0),
            "updatedAt" = NOW()
        FROM (
            SELECT "listId", COUNT(*)::int AS cnt
            FROM main."userListItems"
            GROUP BY "listId"
        ) sub
        WHERE ul."id" = sub."listId"
    `);
};

exports.down = (knex) => knex.schema.withSchema('main').dropTable('userListItems');
