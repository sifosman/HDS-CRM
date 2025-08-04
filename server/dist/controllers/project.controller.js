"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteProject = exports.updateProject = exports.createProject = exports.getProjectById = exports.getAllProjects = void 0;
const project_model_1 = __importDefault(require("../models/project.model"));
// Get all projects
const getAllProjects = async (req, res) => {
    try {
        const projects = await project_model_1.default.find();
        res.status(200).json(projects);
    }
    catch (error) {
        res.status(500).json({ message: 'Error fetching projects', error });
    }
};
exports.getAllProjects = getAllProjects;
// Get a project by ID
const getProjectById = async (req, res) => {
    try {
        const project = await project_model_1.default.findById(req.params.id);
        if (!project) {
            return res.status(404).json({ message: 'Project not found' });
        }
        res.status(200).json(project);
    }
    catch (error) {
        res.status(500).json({ message: 'Error fetching project', error });
    }
};
exports.getProjectById = getProjectById;
// Create a new project
const createProject = async (req, res) => {
    try {
        const newProject = new project_model_1.default(req.body);
        const savedProject = await newProject.save();
        res.status(201).json(savedProject);
    }
    catch (error) {
        res.status(500).json({ message: 'Error creating project', error });
    }
};
exports.createProject = createProject;
// Update a project
const updateProject = async (req, res) => {
    try {
        const updatedProject = await project_model_1.default.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!updatedProject) {
            return res.status(404).json({ message: 'Project not found' });
        }
        res.status(200).json(updatedProject);
    }
    catch (error) {
        res.status(500).json({ message: 'Error updating project', error });
    }
};
exports.updateProject = updateProject;
// Delete a project
const deleteProject = async (req, res) => {
    try {
        const deletedProject = await project_model_1.default.findByIdAndDelete(req.params.id);
        if (!deletedProject) {
            return res.status(404).json({ message: 'Project not found' });
        }
        res.status(200).json({ message: 'Project deleted successfully' });
    }
    catch (error) {
        res.status(500).json({ message: 'Error deleting project', error });
    }
};
exports.deleteProject = deleteProject;
