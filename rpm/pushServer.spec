%define _binaries_in_noarch_packages_terminate_build 0
Name:     	push-server 
Version:   	%{versionModule}
Release:   	%{releaseModule}
Summary:       	Instalation of push server (owd) 
BuildArch:      x86_64
SOURCE0:	%{_topdir}/../
Group:		PDI/OWD/Push_Server 
License:	Tefonica PDI
URL:		http://www.tid.es
Vendor:		Telefonica PDI 

%define _psdir  /opt/pdi/owd/push_server
%description
Servidor que permite mediante un api rest enviar notificaciones desde un servidor de terceros a un dispositivo movil o un navegador de escritorio
%prep
[ -d $RPM_BUILD_ROOT/%{_psdir} ] || %{__mkdir_p} $RPM_BUILD_ROOT/%{_psdir}
%build

%pre
#Create group perserver if not exists
OSUSER=push_server
OSGROUP=push_server

/bin/grep "^$OSGROUP" /etc/group > /dev/null 2>&1
if [ $? != 0 ]
then
  /usr/sbin/groupadd -r -f $OSGROUP
  if [ $? != 0 ]
  then
    echo "Problems creating group $OSGROUP. Exiting."
    exit -1
  fi
fi

#Create user push_server
/usr/bin/id $OSUSER > /dev/null 2>&1
if [ $? != 0 ]
then
  /usr/sbin/useradd -d %{_psdir} -g $OSGROUP -M -r -s /bin/bash  $OSUSER
  if [ $? != 0 ]
  then
    echo "Problems creating user $OSUSER. Exiting."
    exit -1
  fi
fi

%install
mkdir -p $RPM_BUILD_ROOT%{_psdir}/src $RPM_BUILD_ROOT%{_psdir}/node_modules $RPM_BUILD_ROOT%{_psdir}/test
%{__cp} -R %{_topdir}/../../src/* $RPM_BUILD_ROOT%{_psdir}/src/
%{__cp} -R %{_topdir}/../../node_modules/* $RPM_BUILD_ROOT%{_psdir}/node_modules/
%{__cp} -R %{_topdir}/../../test/* $RPM_BUILD_ROOT%{_psdir}/test/

%clean
rm -rf $RPM_BUILD_ROOT

%files
%defattr(755,push_server,push_server,-)
%{_psdir}

%changelog
