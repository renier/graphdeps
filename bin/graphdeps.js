#!/usr/bin/env node
/*jshint node:true, es5:true */
/**
 * Scan for module dirs (those with a package.json file)
 * Skip symbolic links.
 *
 * For each module dir:
 * Note dependencies, bundleDeps, devDeps, and optionalDeps.
 * Add to output.
 * scan for module dirs under node_modules.
 */

var argv = require('optimist').
        usage('Usage: $0 [options] <directory>').
        demand(1).
        describe('deptypes', 'Graph these additional dependency types (e.g. "dev,optional").').
        describe('excludes', 'Exclude these modules from the traversal (e.g. "npm,grunt").').
        argv,
    fs = require('fs'),
    path = require('path'),
    g = require('graphviz').digraph('G'),
    edges = {},
    DEPTYPES = argv.deptypes ? [""].concat(argv.deptypes.split(/,/)) : [""],
    REALDEPTYPES = DEPTYPES.map(function(d) { return !d ? "dependencies" : d+"Dependencies"; }),
    EXCLUDES = argv.excludes ? argv.excludes.split(/,/) : [],
    html = "";

function getPackageJson(modulePath) {
    try {
        return JSON.parse(fs.readFileSync(path.join(modulePath, "package.json")));
    } catch(e) {
        return null;
    }
}

function addHtml(json, isRuntime) {
    var a, homepage;
    html += "<tr>";
    if (json.homepage) {
        homepage = typeof json.homepage === 'string' ? json.homepage : json.homepage[0];
        html += "<td><a href=\"" + homepage + "\">" + json.name + "</a></td>";
    } else {
        html += "<td>" + json.name + "</td>";
    }
    html += "<td>" + json.version + "</td>";
    if (json.license) {
        if (typeof json.license === 'string') {
            html += "<td>" + json.license + "</td>";
        } else {
            html += "<td><a href=\"" + json.license.url + "\">" + json.license.type + "</a></td>";
        }
    } else if (json.licenses && json.licenses.length > 0) {
        a = [];
        html += "<td>";
        json.licenses.forEach(function(license) {
            if (typeof license === 'string') {
                a.push(license);
            } else {
                a.push("<a href=\"" + license.url + "\">" + license.type + "</a>");
            }
        });
        html += a.join("|");
        html += "</td>";
    } else {
        html += "<td>&nbsp;</td>";
    }
    html += "<td>" + (json.description || "") + "</td>";
    html += "<td>" + (isRuntime ? "Yes" : "No") + "</td>";
    html += "<td>&nbsp;</td>";
    html += "</tr>\n";
}

function grokDeps(dir, forceDev, depKind) {
    var packageJson = getPackageJson(dir),
        depDesc = forceDev ? "dev" : depKind,
        name = packageJson.name,
        version = packageJson.version,
        sourceId = name + " " + version;
    
    depKind = depKind ? depKind + "Dependencies" : "dependencies";

    if (!g.getNode(sourceId)) {
        g.addNode(sourceId);
        addHtml(packageJson, depDesc ? false : true);
    }

    // Add dep info to output
    if (packageJson[depKind]) {
        Object.keys(packageJson[depKind]).forEach(function(key) {
            var targetId = key + " ",
                targetDir = path.join(dir, "node_modules", key),
                searchDir, targetJson;

            if (!fs.existsSync(targetDir)) {
                if (depKind !== "dependencies") {
                    return; // other kinds of deps nested in are not installed.
                }
                // If standard dep was not installed where we thought,
                // it is probably already installed already higher up the chain.
                // Find it.
                searchDir = path.dirname(dir);
                while (!fs.existsSync(path.join(searchDir, key))) {
                    if (searchDir === path.dirname(searchDir)) {
                        return; // reached the top. give up.
                    }
                    searchDir = path.dirname(searchDir);
                }
                targetDir = path.join(searchDir, key);
            }
            targetJson = getPackageJson(targetDir);
            targetId += targetJson.version;

            if (!g.getNode(targetId)) {
                g.addNode(targetId);
                addHtml(targetJson, depDesc ? false : true);
            }
            if (edges[sourceId + " | " + targetId] === undefined) {
                g.addEdge(sourceId, targetId, { label: depDesc });
                edges[sourceId + " | " + targetId] = null;
            }
        });
    }
}

function start(contextDir, forceDev) {
    if (!fs.existsSync(contextDir)) { return; }

    // Scan for module dirs (thos with a package.json file)
    var dirs = fs.readdirSync(contextDir), targets = [],
        packageJson = getPackageJson(path.dirname(contextDir));

    // Filter out bad dirs
    dirs.forEach(function(dir) {
        var found = false, target;
        if (dir.indexOf('.') === 0) { return; }
        if (EXCLUDES.indexOf(dir) !== -1) { return; }
        target = path.join(contextDir, dir);
        if (fs.lstatSync(target).isSymbolicLink()) { return; }
        if (!fs.statSync(target).isDirectory()) { return; }
        if (!fs.existsSync(path.join(target, 'package.json'))) { return; }

        if (packageJson) {
            REALDEPTYPES.forEach(function(depType) {
                if (packageJson[depType] && dir in packageJson[depType]) {
                    found = true;
                }
            });
            if (!found) { return; }   
        }

        targets.push(target);
    });

    targets.forEach(function(dir) {
        // We want to propagate a dev relationship for all dependencies
        // of a first dev dependency.
        var force = false;
        if (!forceDev) {
            if (packageJson &&
                (!packageJson.dependencies || !packageJson.dependencies[path.basename(dir)]) &&
                (packageJson.devDependencies && packageJson.devDependencies[path.basename(dir)])) {
                // This is a dev dependency
                force = true;
            }
        } else { force = forceDev; }
        // For each module dir, note dependencies...
        DEPTYPES.forEach(grokDeps.bind(global, dir, force));
        start(path.join(dir, "node_modules"), force);
    });
}

start(argv._[0]);
console.log(g.nodeCount() + " unique dependencies found.");
g.output("png", "deps.png");
console.log("Created graph deps.png.");

// Write html
html = 
    '    <table border="1" cellpadding="0" cellspacing="0" style="width: 98%; ">\n' +
    '        <thead>\n' +
    '            <tr>\n' +
    '                <th scope="col" style="background-color: #000080; ">\n' +
    '                    <span style="color:#e6e6fa;">Name</span></th>\n' +
    '                <th scope="col" style="background-color: #000080; ">\n' +
    '                    <span style="color:#e6e6fa;">Version</span></th>\n' +
    '                <th scope="col" style="background-color: #000080; ">\n' +
    '                    <span style="color:#e6e6fa;">License</span></th>\n' +
    '                <th scope="col" style="background-color: #000080; ">\n' +
    '                    <span style="color:#e6e6fa;">Description</span></th>\n' +
    '                <th scope="col" style="background-color: #000080; ">\n' +
    '                    <span style="color:#e6e6fa;">Part of runtime?</span></th>\n' +
    '                <th scope="col" style="background-color: #000080; ">\n' +
    '                    <span style="color:#e6e6fa;">Confidence level that we need to ship this with the product? (H, M, L)</span></th>\n' +
    '            </tr>\n' +
    '        </thead>\n' +
    '        <tbody>\n' + 
    html;
html += "        </tbody>\n";
html += "    </table>";
fs.writeFileSync("deps.html", html);
console.log("Wrote table data to deps.html.");
