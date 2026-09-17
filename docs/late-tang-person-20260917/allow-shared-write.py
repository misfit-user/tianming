from pathlib import Path
p=Path(__file__).with_name('patch-ui.py');t=p.read_text(encoding='utf-8')
a="        assert not dest.exists(),'UI backup exists; do not reapply blindly'"
b="        if dest.exists(): assert dest.read_bytes()==old,'UI backup differs; stop'"
assert t.count(a)==1;t=t.replace(a,b)
a='        os.replace(temp,path)'
b="        try: os.replace(temp,path)\n        except PermissionError:\n            assert path.read_bytes()==old,'Concurrent UI change'\n            with path.open('r+b') as stream:\n                stream.write(new);stream.truncate();stream.flush();os.fsync(stream.fileno())\n        assert path.read_bytes()==new,'UI write verification failed'"
assert t.count(a)==1;p.write_text(t.replace(a,b),encoding='utf-8')
print('Added byte-verified normal write for Windows files opened without delete sharing; permissions unchanged.')
