"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderTemplate = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const handlebars_1 = __importDefault(require("handlebars"));
/**
 * Template Service
 * Handles rendering HTML templates with data
 */
// Register Handlebars helpers
handlebars_1.default.registerHelper('inc', (value) => {
    return value + 1;
});
/**
 * Render a template with data
 * @param templateName Name of the template file (without extension)
 * @param data Data to render the template with
 */
const renderTemplate = async (templateName, data) => {
    const templatePath = path_1.default.join(__dirname, '..', 'templates', `${templateName}.html`);
    try {
        // Read the template file
        const templateSource = fs_1.default.readFileSync(templatePath, 'utf8');
        // Compile the template
        const template = handlebars_1.default.compile(templateSource);
        // Render the template with data
        return template(data);
    }
    catch (error) {
        console.error(`Error rendering template ${templateName}:`, error);
        throw new Error(`Failed to render template: ${templateName}`);
    }
};
exports.renderTemplate = renderTemplate;
