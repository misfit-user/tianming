// Read-only Restart Manager query for the single authorized source file.
// This helper never terminates processes or changes file permissions.
using System;
using System.Runtime.InteropServices;
using System.Runtime.InteropServices.ComTypes;
using System.Text;
public static class ShaosongFileLockOwners {
 [StructLayout(LayoutKind.Sequential)] struct UniqueProcess {
  public int ProcessId; public System.Runtime.InteropServices.ComTypes.FILETIME StartTime;
 }
 [StructLayout(LayoutKind.Sequential,CharSet=CharSet.Unicode)] struct ProcessInfo {
  public UniqueProcess Process;
  [MarshalAs(UnmanagedType.ByValTStr,SizeConst=256)] public string AppName;
  [MarshalAs(UnmanagedType.ByValTStr,SizeConst=64)] public string ServiceName;
  public uint AppType; public uint AppStatus; public uint SessionId;
  [MarshalAs(UnmanagedType.Bool)] public bool Restartable;
 }
 [DllImport("rstrtmgr.dll",CharSet=CharSet.Unicode)] static extern int RmStartSession(out uint session,int flags,StringBuilder key);
 [DllImport("rstrtmgr.dll",CharSet=CharSet.Unicode)] static extern int RmRegisterResources(uint session,uint files,string[] names,uint processes,IntPtr processArray,uint services,string[] serviceNames);
 [DllImport("rstrtmgr.dll")] static extern int RmGetList(uint session,out uint needed,ref uint count,[In,Out] ProcessInfo[] info,ref uint reasons);
 [DllImport("rstrtmgr.dll")] static extern int RmEndSession(uint session);
 public static string Query(string file) {
  uint session; int rc=RmStartSession(out session,0,new StringBuilder(64));
  if(rc!=0)throw new Exception("RmStartSession="+rc);
  try {
   rc=RmRegisterResources(session,1,new string[]{file},0,IntPtr.Zero,0,null);
   if(rc!=0)throw new Exception("RmRegisterResources="+rc);
   uint needed=0,count=0,reasons=0;
   rc=RmGetList(session,out needed,ref count,null,ref reasons);
   if(rc==0)return "No registered lock owner.";
   if(rc!=234)throw new Exception("RmGetList="+rc);
   count=needed;var owners=new ProcessInfo[count];
   rc=RmGetList(session,out needed,ref count,owners,ref reasons);
   if(rc!=0)throw new Exception("RmGetList detail="+rc);
   var result=new StringBuilder();
   for(int i=0;i<count;i++)result.AppendLine("PID="+owners[i].Process.ProcessId+" APP="+owners[i].AppName);
   return result.ToString();
  } finally {RmEndSession(session);}
 }
}
