extends Node

const WorldMapViewScript := preload("res://scripts/world_map_view.gd")

func _ready() -> void:
	var view: Control = WorldMapViewScript.new()
	add_child(view)
	await get_tree().process_frame
	if not view.has_method("_region_color"):
		_fail("World map view does not expose region color calculation")
		return

	var base_region: Dictionary = {
		"id": "map-color-test",
		"name": "地图颜色测试",
		"owner": "大明",
		"owner_id": "ming",
		"controller": "大明",
		"controller_id": "ming",
		"color": "#336699",
		"prosperity": 50
	}
	var rebel_region: Dictionary = base_region.duplicate(true)
	rebel_region["controller"] = "地图颜色测试民变军"
	rebel_region["controller_id"] = "runtime-uprising-map-color-test"

	var ming_color: Color = view.call("_region_color", base_region)
	var rebel_color: Color = view.call("_region_color", rebel_region)
	if _same_color(ming_color, rebel_color):
		_fail("World map color still follows static region color instead of live controller")
		return

	var same_controller_region: Dictionary = base_region.duplicate(true)
	same_controller_region["owner"] = "后金"
	same_controller_region["owner_id"] = "later_jin"
	same_controller_region["controller"] = "大明"
	same_controller_region["controller_id"] = "ming"
	var same_controller_color: Color = view.call("_region_color", same_controller_region)
	if not _same_color(ming_color, same_controller_color):
		_fail("World map color should remain stable when controller is unchanged")
		return

	print("[TianmingGodotTest] world map controller color scene test passed")
	_finish(0)

func _same_color(a: Color, b: Color) -> bool:
	return is_equal_approx(a.r, b.r) and is_equal_approx(a.g, b.g) and is_equal_approx(a.b, b.b) and is_equal_approx(a.a, b.a)

func _fail(message: String) -> void:
	print("[TianmingGodotTest] world map controller color scene test failed: %s" % message)
	push_error(message)
	_finish(1)

func _finish(exit_code: int) -> void:
	print("[TianmingGodotTest] world map controller color scene test exit_code=%d" % exit_code)
	get_tree().quit(exit_code)
