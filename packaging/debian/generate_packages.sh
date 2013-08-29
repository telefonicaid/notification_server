#!/bin/bash

VERSION=`git describe`
VERSION=${VERSION%-g*}
VERSION=${VERSION:1}

SOURCES=../../src
OUTPUT=$SOURCES/../output/debian

function generate_deb() {
  echo "Generating package for pns-$1..."

  mkdir -p pns-$1/DEBIAN
  sed 's/VERSION/'$VERSION'/' DEBIAN.skel/pns-$1.control > pns-$1/DEBIAN/control
  mkdir -p pns-$1/usr/lib/pns/
  case $1 in
    as)
      cp -al $SOURCES/ns_as pns-$1/usr/lib/pns/
      ;;

    monitor)
      cp -al $SOURCES/ns_msg_mon pns-$1/usr/lib/pns
      ;;

    ua)
      cp -al $SOURCES/ns_ua pns-$1/usr/lib/pns
      ;;

    wakeup)
      cp -al $SOURCES/ns_wakeup pns-$1/usr/lib/pns
      ;;

    common)
      cp -al $SOURCES/common pns-$1/usr/lib/pns
      cp -al $SOURCES/views pns-$1/usr/lib/pns
      cp -al DEBIAN.skel/postinst.common pns-$1/DEBIAN/postinst
      cp -al DEBIAN.skel/prerm.common pns-$1/DEBIAN/prerm
      mkdir -p pns-$1/var/log/push-server/
      ;;
  esac
  
  fakeroot dpkg -b pns-$1 $OUTPUT/pns-$1_$VERSION.deb
  rm -r pns-$1
}

echo "Generating packages for version $VERSION"
mkdir -p $OUTPUT

generate_deb common
generate_deb as
generate_deb ua
generate_deb wakeup
generate_deb monitor
