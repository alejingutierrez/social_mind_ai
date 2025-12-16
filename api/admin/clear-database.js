const { query } = require('../../serverless_lib/db')

/**
 * Admin endpoint to clear all tables in the database
 * This will delete all data from news_articles, insights, and analysis_results
 * Use with caution!
 */
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Simple authentication - check for admin token
  const adminToken = req.headers['x-admin-token'] || req.query.token
  const expectedToken = process.env.ADMIN_TOKEN || 'change-me-in-production'

  if (adminToken !== expectedToken) {
    return res.status(401).json({ error: 'Unauthorized - invalid admin token' })
  }

  try {
    // Clear all tables in reverse dependency order
    await query('DELETE FROM analysis_results')
    await query('DELETE FROM insights')
    await query('DELETE FROM news_articles')

    // Reset sequences (PostgreSQL specific)
    await query('ALTER SEQUENCE IF EXISTS analysis_results_id_seq RESTART WITH 1')
    await query('ALTER SEQUENCE IF EXISTS insights_id_seq RESTART WITH 1')
    await query('ALTER SEQUENCE IF EXISTS news_articles_id_seq RESTART WITH 1')

    return res.status(200).json({
      success: true,
      message: 'All tables cleared successfully',
      tables_cleared: ['news_articles', 'insights', 'analysis_results'],
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error clearing database:', error)
    return res.status(500).json({
      error: 'Failed to clear database',
      message: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}
