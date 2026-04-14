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

    // 2) Backfill userLists from existing spaceReactions.userBookmarkCategory.
    //    One list per (userId, userBookmarkCategory). We insert every one with
    //    isDefault=false here; step 3 promotes exactly one list per user to
    //    default, respecting the partial unique index on (userId) WHERE isDefault=true.
    await knex.raw(`
        INSERT INTO main."userLists" ("userId", "name", "isDefault", "itemCount", "createdAt", "updatedAt")
        SELECT sr."userId",
               COALESCE(NULLIF(TRIM(sr."userBookmarkCategory"), ''), 'Saved') AS name,
               false AS "isDefault",
               COUNT(*) AS "itemCount",
               NOW(),
               NOW()
        FROM main."spaceReactions" sr
        WHERE sr."userBookmarkCategory" IS NOT NULL
        GROUP BY sr."userId", COALESCE(NULLIF(TRIM(sr."userBookmarkCategory"), ''), 'Saved')
        ON CONFLICT DO NOTHING
    `);

    // 3a) For each user with existing bookmarks, promote exactly one list to
    //     default, preferring 'Uncategorized' > 'Saved' > any other name.
    await knex.raw(`
        WITH candidates AS (
            SELECT ul.id,
                   ul."userId",
                   ROW_NUMBER() OVER (
                       PARTITION BY ul."userId"
                       ORDER BY CASE LOWER(ul.name)
                                    WHEN 'uncategorized' THEN 1
                                    WHEN 'saved' THEN 2
                                    ELSE 3
                                END,
                                ul."createdAt" ASC
                   ) AS rank
            FROM main."userLists" ul
        )
        UPDATE main."userLists" ul
        SET "isDefault" = true, "updatedAt" = NOW()
        FROM candidates c
        WHERE c.id = ul.id AND c.rank = 1
    `);

    // 3b) Any user with bookmarks but no lists (e.g., if every category was
    //     empty/whitespace which got normalized) gets a fresh "Saved" default.
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
