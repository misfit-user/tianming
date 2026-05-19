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
	game_state.call("advance_month")
	await get_tree().process_frame
	game_state.call("advance_month")
	await get_tree().process_frame

	var panel: Node = _find_node_with_script(main, "res://scripts/monthly_report_panel.gd")
	if panel == null:
		_fail("Main scene does not expose the monthly report panel")
		return
	if not panel.has_method("select_report") or not panel.has_method("visible_text"):
		_fail("Monthly report panel does not expose history selection in main scene")
		return
	panel.call("select_report", 1)
	var text: String = str(panel.call("visible_text"))
	if not text.contains("1627年9月") or text.contains("1627年10月"):
		_fail("Main monthly report panel did not preserve older monthly report")
		return

	print("[TianmingGodotTest] monthly report history main scene test passed")
	_finish(0)

func _find_node_with_script(root: Node, script_path: String) -> Node:
	var script: Script = root.get_script()
	if script != null and script.resource_path == script_path:
		return root
	for child in root.get_children():
		var found: Node = _find_node_with_script(child, script_path)
		if found != null:
			return found
	return null

func _fail(message: String) -> void:
	print("[TianmingGodotTest] monthly report history main scene test failed: %s" % message)
	push_error(message)
	_finish(1)

func _finish(exit_code: int) -> void:
	print("[TianmingGodotTest] monthly report history main scene test exit_code=%d" % exit_code)
	get_tree().quit(exit_code)
