extends Node

const MainScene := preload("res://scenes/main.tscn")

func _ready() -> void:
	var main: Node = MainScene.instantiate()
	add_child(main)
	await get_tree().process_frame

	var game_state: RefCounted = main.get("game_state") as RefCounted
	if game_state == null:
		_fail("Main scene did not initialize GameState")
		return

	var old_huangquan: int = roundi(float(game_state.get("huangquan")))
	var new_huangquan: int = old_huangquan - 7
	if new_huangquan == old_huangquan:
		new_huangquan -= 1
	game_state.set("huangquan", float(new_huangquan))
	main.call("_refresh_runtime_bar")
	await get_tree().process_frame

	var panel: Node = _find_node_with_script(main, "res://scripts/overview_summary_panel.gd")
	if panel == null:
		_fail("Main scene does not expose OverviewSummaryPanel")
		return

	var live_labels: Dictionary = _dict(panel.get("live_summary_value_labels"))
	var huangquan_label: Label = live_labels.get("huangquan", null) as Label
	if huangquan_label == null:
		_fail("Overview imperial authority summary row is not bound to runtime state")
		return
	if str(huangquan_label.text) != str(new_huangquan):
		_fail("Overview imperial authority summary row stayed stale after runtime state changed")
		return

	print("[TianmingGodotTest] overview summary live metrics scene test passed")
	_finish(0)

func _fail(message: String) -> void:
	print("[TianmingGodotTest] overview summary live metrics scene test failed: %s" % message)
	push_error(message)
	_finish(1)

func _dict(value: Variant) -> Dictionary:
	return value if typeof(value) == TYPE_DICTIONARY else {}

func _find_node_with_script(root: Node, script_path: String) -> Node:
	var script: Script = root.get_script()
	if script != null and script.resource_path == script_path:
		return root
	for child in root.get_children():
		var found: Node = _find_node_with_script(child, script_path)
		if found != null:
			return found
	return null

func _finish(exit_code: int) -> void:
	print("[TianmingGodotTest] overview summary live metrics scene test exit_code=%d" % exit_code)
	get_tree().quit(exit_code)
