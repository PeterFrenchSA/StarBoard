-- Align child profile theme defaults to new child-selectable theme set.
ALTER TABLE "ChildProfile"
ALTER COLUMN "colorTheme" SET DEFAULT 'fairies';

-- Map legacy color values into the new theme taxonomy.
UPDATE "ChildProfile" SET "colorTheme" = 'fairies' WHERE "colorTheme" IN ('sun', 'mint');
UPDATE "ChildProfile" SET "colorTheme" = 'dragons' WHERE "colorTheme" = 'coral';
UPDATE "ChildProfile" SET "colorTheme" = 'engineering' WHERE "colorTheme" = 'sky';
