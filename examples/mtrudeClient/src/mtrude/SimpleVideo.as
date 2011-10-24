package mtrude {
  import flash.media.Camera;
  import flash.media.Video;
  import flash.net.NetStream;
  
  import mx.core.UIComponent;
  import mx.events.FlexEvent;
  
  public class SimpleVideo extends UIComponent {
    public var videoPlayer:Video;
    
    public function SimpleVideo() {
      super();
      
      addEventListener(FlexEvent.CREATION_COMPLETE, init);
      videoPlayer = new Video();
      addChild(videoPlayer);
    }
    
    private function init(event:FlexEvent):void {
      removeEventListener(FlexEvent.CREATION_COMPLETE, init);
      videoPlayer.visible = true;
      videoPlayer.width = width;
      videoPlayer.height = height;
    }
    
    
    public function get smoothing():Boolean {
      return videoPlayer == null ? false : videoPlayer.smoothing;
    }
    
    public function set smoothing(smoothing:Boolean):void {
      if (videoPlayer == null) throw Error("Creation not yet complete");
      videoPlayer.smoothing = smoothing;
    }
    
    public function attachCamera(cam:Camera):void {
      videoPlayer.attachCamera(cam);
    }
    
    public function attachNetStream(ns:NetStream):void {
      videoPlayer.attachNetStream(ns);
    }
  }
}
