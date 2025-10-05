const mysql = require('mysql2/promise');

async function addStudyColumns() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'mentor',
    password: 'password',
    database: 'mentor_app',
  });

  try {
    console.log('Adding study-related columns to mentee_profiles table...');

    // Add study-related columns to mentee_profiles
    await connection.execute(`
      ALTER TABLE mentee_profiles 
      ADD COLUMN currentBook VARCHAR(100) DEFAULT NULL,
      ADD COLUMN currentChapter INT DEFAULT 1,
      ADD COLUMN completedChapters JSON DEFAULT NULL,
      ADD COLUMN studyDays INT DEFAULT 0
    `);

    console.log('✅ Study columns added to mentee_profiles table');

    // Now add the study data
    const [users] = await connection.execute(`
      SELECT u.id, u.firstName, u.lastName, u.email
      FROM users u 
      JOIN mentee_profiles mp ON u.id = mp.userId 
      WHERE u.firstName IS NOT NULL
    `);

    console.log(`Found ${users.length} mentees to update with study data`);

    // Study paths data - different for each mentee
    const studyPathsData = [
      {
        spiritualGrowthAreas: ['Accountability', 'Spiritual Discipline'],
        currentBook: 'James',
        currentChapter: 3,
        completedChapters: [1, 2],
        studyDays: 12,
      },
      {
        spiritualGrowthAreas: ['Consistent prayer life', "Hearing God's voice"],
        currentBook: 'Romans',
        currentChapter: 8,
        completedChapters: [1, 2, 3, 4, 5, 6, 7],
        studyDays: 18,
      },
      {
        spiritualGrowthAreas: ['Evangelism', 'Accountability'],
        currentBook: 'Acts',
        currentChapter: 15,
        completedChapters: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14],
        studyDays: 25,
      },
      {
        spiritualGrowthAreas: [
          'Spiritual Discipline',
          'Consistent prayer life',
        ],
        currentBook: '1 Corinthians',
        currentChapter: 12,
        completedChapters: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
        studyDays: 21,
      },
      {
        spiritualGrowthAreas: ["Hearing God's voice", 'Evangelism'],
        currentBook: 'John',
        currentChapter: 6,
        completedChapters: [1, 2, 3, 4, 5],
        studyDays: 15,
      },
    ];

    // Streak data - different for each mentee
    const streakData = [
      {
        currentStreak: 7,
        longestStreak: 15,
        lastStreakDate: new Date(Date.now() - 0 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0], // Today
        weeklyStreakData: JSON.stringify([5, 7, 6, 7, 4, 7, 7]), // Last 7 days
      },
      {
        currentStreak: 12,
        longestStreak: 21,
        lastStreakDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0], // Yesterday
        weeklyStreakData: JSON.stringify([7, 7, 7, 6, 7, 7, 12]), // Last 7 days
      },
      {
        currentStreak: 5,
        longestStreak: 18,
        lastStreakDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0], // 2 days ago
        weeklyStreakData: JSON.stringify([3, 5, 4, 5, 6, 5, 5]), // Last 7 days
      },
      {
        currentStreak: 9,
        longestStreak: 16,
        lastStreakDate: new Date(Date.now() - 0 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0], // Today
        weeklyStreakData: JSON.stringify([7, 6, 7, 7, 8, 9, 9]), // Last 7 days
      },
      {
        currentStreak: 3,
        longestStreak: 12,
        lastStreakDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0], // Yesterday
        weeklyStreakData: JSON.stringify([2, 3, 4, 3, 2, 3, 3]), // Last 7 days
      },
    ];

    for (let i = 0; i < users.length; i++) {
      const user = users[i];
      const studyPath = studyPathsData[i % studyPathsData.length];
      const streak = streakData[i % streakData.length];

      // Update mentee profile with study data
      await connection.execute(
        `UPDATE mentee_profiles 
         SET 
           spiritualGrowthAreas = ?,
           currentBook = ?,
           currentChapter = ?,
           completedChapters = ?,
           studyDays = ?
         WHERE userId = ?`,
        [
          JSON.stringify(studyPath.spiritualGrowthAreas),
          studyPath.currentBook,
          studyPath.currentChapter,
          JSON.stringify(studyPath.completedChapters),
          studyPath.studyDays,
          user.id,
        ]
      );

      // Update user with streak data
      await connection.execute(
        `UPDATE users 
         SET 
           currentStreak = ?,
           longestStreak = ?,
           lastStreakDate = ?,
           weeklyStreakData = ?
         WHERE id = ?`,
        [
          streak.currentStreak,
          streak.longestStreak,
          streak.lastStreakDate,
          streak.weeklyStreakData,
          user.id,
        ]
      );

      console.log(`✅ Added study data for ${user.firstName} ${user.lastName}`);
      console.log(
        `   📖 Current: ${studyPath.currentBook} Chapter ${studyPath.currentChapter}`
      );
      console.log(
        `   🔥 Streak: ${streak.currentStreak} days (Longest: ${streak.longestStreak})`
      );
      console.log(`   📚 Areas: ${studyPath.spiritualGrowthAreas.join(', ')}`);
    }

    console.log('🎉 All study data and streaks added successfully!');
  } catch (error) {
    console.error('❌ Error adding study data:', error.message);
  } finally {
    await connection.end();
  }
}

addStudyColumns();
