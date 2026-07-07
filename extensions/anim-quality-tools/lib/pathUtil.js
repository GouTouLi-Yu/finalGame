'use strict';

const path = require('path');

function getProjectRoot() {
    return Editor.Project.path;
}

function toPosixPath(value) {
    return value.split(path.sep).join('/');
}

function toRelativePath(absolutePath) {
    return toPosixPath(path.relative(getProjectRoot(), absolutePath));
}

function toDbUrl(relativePath) {
    return `db://${toPosixPath(relativePath)}`;
}

module.exports = {
    getProjectRoot,
    toPosixPath,
    toRelativePath,
    toDbUrl,
};
