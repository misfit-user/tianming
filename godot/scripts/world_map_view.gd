extends Control

class_name WorldMapView

signal region_selected(region: Dictionary)

var map_data: Dictionary = {}
var regions: Array = []
var bounds: Dictionary = {}
var selected_region_id: String = ""
var hovered_region_id: String = ""
var _layout_origin: Vector2 = Vector2.ZERO
var _layout_scale: float = 1.0

func set_map_data(value: Dictionary) -> void:
	var previous_selected_id: String = selected_region_id
	map_data = value
	regions = _safe_array(map_data.get("regions", []))
	bounds = _safe_dict(map_data.get("bounds", {}))
	selected_region_id = previous_selected_id if not _region_by_id(previous_selected_id).is_empty() else ""
	hovered_region_id = ""
	tooltip_text = "点击地块查看详情"
	if not selected_region_id.is_empty():
		emit_signal("region_selected", _region_by_id(selected_region_id))
	queue_redraw()

func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_STOP
	mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND

func _draw() -> void:
	var rect_size: Vector2 = size
	draw_rect(Rect2(Vector2.ZERO, rect_size), Color(0.055, 0.047, 0.039, 1.0), true)
	draw_rect(Rect2(Vector2.ZERO, rect_size), Color(0.56, 0.43, 0.22, 0.55), false, 1.0)

	if regions.is_empty():
		return

	_update_layout(rect_size)

	for raw_region in regions:
		var region: Dictionary = _safe_dict(raw_region)
		var region_id: String = _region_id(region)
		var poly: PackedVector2Array = _coords_to_polygon(_safe_array(region.get("coords", [])), _layout_origin, _layout_scale)
		if poly.size() < 3:
			continue
		var color: Color = _region_color(region)
		var outline: PackedVector2Array = poly.duplicate()
		outline.append(poly[0])
		var center: Vector2 = _polygon_center(poly)
		var outline_color: Color = color.lightened(0.18)
		var outline_width: float = 1.2
		var dot_radius: float = 3.5

		if region_id == selected_region_id:
			outline_color = Color(0.98, 0.78, 0.32, 1.0)
			outline_width = 2.4
			dot_radius = 5.6
		elif region_id == hovered_region_id:
			outline_color = color.lightened(0.45)
			outline_width = 2.0
			dot_radius = 4.6

		draw_polyline(outline, outline_color, outline_width, true)
		draw_circle(center, dot_radius, outline_color)

func _gui_input(event: InputEvent) -> void:
	if event is InputEventMouseMotion:
		var motion: InputEventMouseMotion = event as InputEventMouseMotion
		var region: Dictionary = _pick_region_at(motion.position)
		var next_hovered_id: String = _region_id(region)
		if next_hovered_id != hovered_region_id:
			hovered_region_id = next_hovered_id
			tooltip_text = str(region.get("name", "点击地块查看详情")) if not region.is_empty() else "点击地块查看详情"
			queue_redraw()
	elif event is InputEventMouseButton:
		var button: InputEventMouseButton = event as InputEventMouseButton
		if button.button_index == MOUSE_BUTTON_LEFT and button.pressed:
			var picked: Dictionary = _pick_region_at(button.position)
			if not picked.is_empty():
				selected_region_id = _region_id(picked)
				emit_signal("region_selected", picked)
				queue_redraw()

func select_region_by_index(index: int) -> void:
	if index < 0 or index >= regions.size():
		return
	var region: Dictionary = _safe_dict(regions[index])
	if region.is_empty():
		return
	selected_region_id = _region_id(region)
	emit_signal("region_selected", region)
	queue_redraw()

func _update_layout(rect_size: Vector2) -> void:
	var min_x: float = _num(bounds.get("min_x", 0.0))
	var min_y: float = _num(bounds.get("min_y", 0.0))
	var max_x: float = _num(bounds.get("max_x", 1.0))
	var max_y: float = _num(bounds.get("max_y", 1.0))
	var source_size: Vector2 = Vector2(maxf(1.0, max_x - min_x), maxf(1.0, max_y - min_y))
	var margin: float = 14.0
	var available: Vector2 = Vector2(maxf(1.0, rect_size.x - margin * 2.0), maxf(1.0, rect_size.y - margin * 2.0))
	_layout_scale = minf(available.x / source_size.x, available.y / source_size.y)
	var drawn_size: Vector2 = source_size * _layout_scale
	_layout_origin = (rect_size - drawn_size) * 0.5 - Vector2(min_x, min_y) * _layout_scale

func _pick_region_at(local_pos: Vector2) -> Dictionary:
	if regions.is_empty():
		return {}

	_update_layout(size)
	var nearest_region: Dictionary = {}
	var nearest_distance: float = INF

	for raw_region in regions:
		var region: Dictionary = _safe_dict(raw_region)
		var poly: PackedVector2Array = _coords_to_polygon(_safe_array(region.get("coords", [])), _layout_origin, _layout_scale)
		if poly.size() < 3:
			continue
		if _point_in_polygon(local_pos, poly):
			return region

		var center: Vector2 = _polygon_center(poly)
		var distance: float = local_pos.distance_to(center)
		if distance < nearest_distance:
			nearest_distance = distance
			nearest_region = region

	return nearest_region if nearest_distance <= 14.0 else {}

func _coords_to_polygon(coords: Array, origin: Vector2, map_scale: float) -> PackedVector2Array:
	var poly: PackedVector2Array = PackedVector2Array()
	for i in range(0, coords.size() - 1, 2):
		var x: float = _num(coords[i])
		var y: float = _num(coords[i + 1])
		poly.append(origin + Vector2(x, y) * map_scale)
	return poly

func _polygon_center(poly: PackedVector2Array) -> Vector2:
	var center: Vector2 = Vector2.ZERO
	if poly.is_empty():
		return center
	for point in poly:
		center += point
	return center / float(poly.size())

func _point_in_polygon(point: Vector2, poly: PackedVector2Array) -> bool:
	var inside: bool = false
	var previous_index: int = poly.size() - 1
	for current_index in range(poly.size()):
		var current_point: Vector2 = poly[current_index]
		var previous_point: Vector2 = poly[previous_index]
		var crosses_y: bool = (current_point.y > point.y) != (previous_point.y > point.y)
		if crosses_y:
			var denominator: float = previous_point.y - current_point.y
			if absf(denominator) > 0.0001:
				var intersection_x: float = (previous_point.x - current_point.x) * (point.y - current_point.y) / denominator + current_point.x
				if point.x < intersection_x:
					inside = not inside
		previous_index = current_index
	return inside

func _region_id(region: Dictionary) -> String:
	return str(region.get("id", region.get("name", "")))

func _region_by_id(region_id: String) -> Dictionary:
	if region_id.is_empty():
		return {}
	for raw_region in regions:
		var region: Dictionary = _safe_dict(raw_region)
		if _region_id(region) == region_id:
			return region
	return {}

func _region_color(region: Dictionary) -> Color:
	var controller_key: String = _controller_color_key(region)
	var base: Color = _hash_color(controller_key) if not controller_key.is_empty() else _html_color(str(region.get("color", "")))
	if base.a <= 0.0:
		base = _hash_color(str(region.get("name", "")))
	var prosperity: float = clampf(_num(region.get("prosperity", 50.0)) / 100.0, 0.0, 1.0)
	base = base.darkened(0.22 - prosperity * 0.08)
	base.a = 0.72
	return base

func _controller_color_key(region: Dictionary) -> String:
	for key in ["controller_id", "controller", "owner_id", "owner"]:
		var value: String = str(region.get(key, ""))
		if not value.is_empty():
			return value
	return ""

func _html_color(raw_color: String) -> Color:
	if raw_color.length() == 7 and raw_color.begins_with("#"):
		return Color.html(raw_color)
	if raw_color.length() == 9 and raw_color.begins_with("#"):
		return Color.html(raw_color)
	return Color(0, 0, 0, 0)

func _hash_color(hash_seed: String) -> Color:
	var hash_value: int = abs(hash_seed.hash())
	var hue: float = float(hash_value % 360) / 360.0
	return Color.from_hsv(hue, 0.42, 0.78, 0.72)

func _safe_dict(value: Variant) -> Dictionary:
	return value if typeof(value) == TYPE_DICTIONARY else {}

func _safe_array(value: Variant) -> Array:
	return value if typeof(value) == TYPE_ARRAY else []

func _num(value: Variant) -> float:
	if typeof(value) == TYPE_INT or typeof(value) == TYPE_FLOAT:
		return float(value)
	return str(value).to_float()
