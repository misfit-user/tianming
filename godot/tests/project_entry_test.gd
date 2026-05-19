extends Node

func _ready() -> void:
	var main_scene: String = str(ProjectSettings.get_setting("application/run/main_scene", ""))
	if main_scene != "res://scenes/title.tscn":
		_fail("Project main scene should be title.tscn, got %s" % main_scene)
		return
	print("[TianmingGodotTest] project entry scene test passed")
	_finish(0)

func _fail(message: String) -> void:
	print("[TianmingGodotTest] project entry scene test failed: %s" % message)
	push_error(message)
	_finish(1)

func _finish(exit_code: int) -> void:
	print("[TianmingGodotTest] project entry scene test exit_code=%d" % exit_code)
	get_tree().quit(exit_code)
