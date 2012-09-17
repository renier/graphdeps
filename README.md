## Description

This module creates a graph of your node.js project(s) dependencies that includes version numbers and edges labeled according to the type of dependency. That is, devDependencies will say _dev_, optionalDependencies will say _optional_, and so on, except standard dependency edges which will not be labeled. A package found multiple times in the tree with multiple versions, will appear multiple times in the graph, once for each unique version.

It also creates an html table of the dependencies. More info below.

## Installation

	npm install -g graphdeps

## Usage

Go into the directory that **contains** your npm project(s) and:

	graphdeps .

A file called _deps.png_ will be created in the current directory with a graph of the project(s) dependncies. Another file called _deps.html_ will be created with the html table listing the dependencies information.

## Options

* `--deptypes` - comma-delimited list of additional dependency types to graph (e.g. dev,optional).
* `--excludes` - comma-delimited list of module names to exclude from traversal (e.g. npm,grunt).

## License

See LICENSE file.
