const { Client } = require('@notionhq/client');

class NotionService {
  constructor(notionToken, rootPageId) {
    this.notion = new Client({ auth: notionToken });
    this.rootPageId = rootPageId;
  }

  async getOrCreateProjectPage(projectName) {
    try {
      const search = await this.notion.search({
        query: projectName,
        filter: {
          property: 'object',
          value: 'page',
        },
      });

      const exactMatch = (search.results || []).find((page) => {
        const title = this.extractPageTitle(page);
        const parentId = page && page.parent && page.parent.page_id;
        return title === projectName && parentId === this.rootPageId;
      });

      if (exactMatch) {
        return exactMatch.id;
      }
    } catch (_err) {
      // Continue and try create flow.
    }

    try {
      const created = await this.notion.pages.create({
        parent: { page_id: this.rootPageId },
        properties: {
          title: {
            title: [
              {
                text: {
                  content: projectName,
                },
              },
            ],
          },
        },
      });

      return created.id;
    } catch (err) {
      throw err;
    }
  }

  extractPageTitle(page) {
    if (!page || !page.properties) {
      return '';
    }

    const titleProperty = Object.values(page.properties).find(
      (property) => property && property.type === 'title'
    );

    const parts = titleProperty && Array.isArray(titleProperty.title) ? titleProperty.title : [];
    return parts.map((part) => (part && part.plain_text ? part.plain_text : '')).join('').trim();
  }

  async createErrorPage(projectPageId, payload) {
    if (!projectPageId) {
      return null;
    }

    const cleanMessage = String(payload.message || 'No message').slice(0, 50);
    const title = `🐛 ${payload.errorType}: ${cleanMessage}`;
    const tags = Array.isArray(payload.analysis.tags) ? payload.analysis.tags : [];
    const tagLine = tags.map((tag) => `#${String(tag).replace(/\s+/g, '')}`).join(' ');

    const blocks = [
      this.heading('📋 Error Details'),
      this.bullet(`📅 Date: ${payload.date}`),
      this.bullet(`⏰ Time: ${payload.time}`),
      this.bullet(`📁 Path: ${payload.filePath || 'Unknown'}`),
      this.bullet(`📍 Line: ${payload.lineNumber || 'Unknown'}`),
      this.heading('❌ What Went Wrong'),
      this.paragraph(payload.analysis.whatWentWrong),
      this.heading('💡 Solution'),
      this.paragraph(payload.analysis.solution),
      this.heading('🔧 Code Fix'),
      this.code(payload.analysis.codeFix),
      this.heading('🚀 How To Avoid This'),
      this.paragraph(payload.analysis.howToAvoid),
      this.heading(`⭐ Difficulty: ${payload.analysis.difficulty}`),
      this.heading(`🏷️ Tags: ${tagLine || 'None'}`),
      this.heading('📄 Stack Trace'),
      this.code(payload.stack || 'No stack trace'),
    ];

    try {
      const response = await this.notion.pages.create({
        parent: { page_id: projectPageId },
        properties: {
          title: {
            title: [
              {
                text: {
                  content: title,
                },
              },
            ],
          },
        },
        children: blocks,
      });

      return response.id;
    } catch (err) {
      throw err;
    }
  }

  heading(content) {
    return {
      object: 'block',
      type: 'heading_2',
      heading_2: {
        rich_text: [
          {
            type: 'text',
            text: { content: String(content || '') },
          },
        ],
      },
    };
  }

  paragraph(content) {
    return {
      object: 'block',
      type: 'paragraph',
      paragraph: {
        rich_text: [
          {
            type: 'text',
            text: { content: String(content || '') },
          },
        ],
      },
    };
  }

  bullet(content) {
    return {
      object: 'block',
      type: 'bulleted_list_item',
      bulleted_list_item: {
        rich_text: [
          {
            type: 'text',
            text: { content: String(content || '') },
          },
        ],
      },
    };
  }

  code(content) {
    return {
      object: 'block',
      type: 'code',
      code: {
        rich_text: [
          {
            type: 'text',
            text: { content: String(content || '') },
          },
        ],
        language: 'javascript',
      },
    };
  }
}

module.exports = {
  NotionService,
};
