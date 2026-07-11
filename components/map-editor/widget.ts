import type { MenuConfig } from "../bundle/menu-manager";

const NUNU_EDIT: MenuConfig[] = [{
	name: "CSG",
	iconClass: "bx bx-shape-unite",
	children: [
		{ name: "Intersect", target: "edit/csg/intersect", iconClass: "bx bx-shape-intersect" },
		{ name: "Subtract", target: "edit/csg/subtract", iconClass: "bx bx-shape-subtract" },
		{ name: "Union", target: "edit/csg/union", iconClass: "bx bx-shape-unite" }
	]
}, {
	name: "Modifiers",
	iconClass: "bx bx-slider",
	children: [
		{ name: "Simplify", ellipsis: true, target: "edit/modifiers/simplify" },
		{ name: "Subdivide", target: "edit/modifiers/subdivide", iconClass: "bx bx-split" },
		{ name: "Twist", target: "edit/modifiers/twist" }
	]
}, {
	name: "Compute Normals",
	target: "edit/compute_normals"
}, {
	name: "Apply Transformation",
	target: "edit/apply_transformation"
}, {
	name: "Merge Geometries",
	target: "edit/merge_geometries",
	iconClass: "bx bx-merge"
}];



